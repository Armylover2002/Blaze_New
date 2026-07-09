import { PorterOrder } from '../models/porterOrder.model.js';
import { PORTER_ORDER_STATUS } from '../constants/porterOrderStatus.constants.js';
import { appendStatusHistory, logPorterOrderAction } from '../utils/porterOrder.helpers.js';
import { startPorterDispatch, emitPorterOrderStatus } from './porter-order-dispatch.service.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';
import { getOrderQueue } from '../../../../queues/index.js';
import { logger } from '../../../../utils/logger.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { config } from '../../../../config/env.js';

const baseFilter = { isDeleted: { $ne: true } };

/** Minimum lead time before a schedule is accepted (avoids near-instant "schedule"). */
export const PORTER_SCHEDULE_MIN_LEAD_MS = 5 * 60 * 1000;
/** Maximum window into the future for scheduling. */
export const PORTER_SCHEDULE_MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;
/** Reminder fires this many ms before scheduledAt. */
export const PORTER_SCHEDULE_REMINDER_LEAD_MS = 15 * 60 * 1000;
/** Small grace when activating (clock skew / poller lag). */
const ACTIVATE_GRACE_MS = 5_000;
const ENQUEUE_MAX_ATTEMPTS = 3;

/** Reminder jobs: enabled unless explicitly disabled via env. */
export function isPorterScheduleReminderEnabled() {
    const raw = process.env.PORTER_SCHEDULE_REMINDER_ENABLED;
    if (raw == null || raw === '') return true;
    return String(raw).toLowerCase() !== 'false' && raw !== '0';
}

export function buildPorterScheduleJobId(orderId) {
    return `porter-scheduled-${String(orderId)}`;
}

export function buildPorterReminderJobId(orderId) {
    return `porter-schedule-reminder-${String(orderId)}`;
}

/**
 * Normalize client timezone strings to standard IANA.
 * Asia/Calcutta (legacy) → Asia/Kolkata.
 */
export function normalizePorterTimezone(tz) {
    if (tz == null || tz === '') return null;
    const raw = String(tz).trim();
    if (!raw || raw === 'local') return 'Asia/Kolkata';
    if (raw === 'Asia/Calcutta') return 'Asia/Kolkata';
    return raw;
}

/**
 * Validate and normalize a customer/admin scheduledAt (ISO / Date).
 * Returns a Date representing the absolute UTC instant of the local selection.
 */
export function parseAndValidatePorterScheduledAt(raw, { now = new Date() } = {}) {
    if (raw == null || raw === '') {
        throw new ValidationError('scheduledAt is required');
    }
    const when = raw instanceof Date ? new Date(raw.getTime()) : new Date(raw);
    if (Number.isNaN(when.getTime())) {
        throw new ValidationError('Invalid scheduledAt');
    }
    const lead = when.getTime() - now.getTime();
    if (lead < PORTER_SCHEDULE_MIN_LEAD_MS) {
        throw new ValidationError('Schedule time must be at least 5 minutes from now');
    }
    if (lead > PORTER_SCHEDULE_MAX_LEAD_MS) {
        throw new ValidationError('Schedule time cannot be more than 30 days ahead');
    }
    return when;
}

/** Soft gate used at create: past/near times fall through to instant dispatch. */
export function isFuturePorterSchedule(scheduledAt, { now = Date.now(), minLeadMs = 60_000 } = {}) {
    if (!scheduledAt) return false;
    const t = scheduledAt instanceof Date ? scheduledAt.getTime() : new Date(scheduledAt).getTime();
    if (Number.isNaN(t)) return false;
    return t > now + minLeadMs;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeQueueJob(jobId) {
    if (!jobId) return false;
    const queue = getOrderQueue();
    if (!queue) return false;
    try {
        const job = await queue.getJob(jobId);
        if (job) {
            await job.remove();
            return true;
        }
    } catch (err) {
        logger.warn(`[PorterScheduled] Failed to remove job ${jobId}: ${err.message}`);
    }
    return false;
}

export async function removePorterScheduledJobs(orderId, orderDoc = null) {
    const order = orderDoc || await PorterOrder.findById(orderId).select({ schedule: 1 }).lean();
    const scheduleJobId = order?.schedule?.bullJobId || buildPorterScheduleJobId(orderId);
    const reminderJobId = order?.schedule?.reminderJobId || buildPorterReminderJobId(orderId);
    // Always try both deterministic ids + stored ids (covers partial writes).
    const ids = new Set([
        scheduleJobId,
        reminderJobId,
        buildPorterScheduleJobId(orderId),
        buildPorterReminderJobId(orderId),
    ].filter(Boolean));
    await Promise.all([...ids].map((id) => removeQueueJob(id)));
}

/**
 * Enqueue with retries. Returns { job, jobId } where jobId is the BullMQ custom id
 * (`porter-scheduled-{orderId}`) on success, or null if queue unavailable after retries.
 */
async function enqueueDelayedPorterJob(data, options, label) {
    let lastErr = null;
    for (let attempt = 1; attempt <= ENQUEUE_MAX_ATTEMPTS; attempt += 1) {
        try {
            const job = await addOrderJob(data, options);
            if (job) {
                const resolvedId = job.id != null ? String(job.id) : String(options.jobId);
                logger.info(`[PorterScheduled] ${label} enqueued id=${resolvedId} delay=${options.delay}ms attempt=${attempt}`);
                return { job, jobId: resolvedId };
            }
            lastErr = new Error('Order queue unavailable (BULLMQ/REDIS disabled or not connected)');
            logger.warn(`[PorterScheduled] ${label} queue null attempt=${attempt}/${ENQUEUE_MAX_ATTEMPTS}`);
        } catch (err) {
            lastErr = err;
            // Duplicate jobId → treat existing delayed job as success.
            const msg = String(err?.message || '');
            if (/already exists|Job .+ already/i.test(msg) && options.jobId) {
                logger.info(`[PorterScheduled] ${label} already exists id=${options.jobId}`);
                return { job: { id: options.jobId }, jobId: String(options.jobId) };
            }
            logger.warn(`[PorterScheduled] ${label} enqueue failed attempt=${attempt}: ${msg}`);
        }
        if (attempt < ENQUEUE_MAX_ATTEMPTS) {
            await sleep(250 * attempt);
        }
    }
    logger.error(`[PorterScheduled] ${label} failed after ${ENQUEUE_MAX_ATTEMPTS} attempts: ${lastErr?.message || 'unknown'}`);
    return { job: null, jobId: null };
}

/**
 * Enqueue delayed BullMQ jobs for dispatch (+ optional 15-min reminder).
 * Stores job ids; NEVER writes reminderSentAt here.
 * Relies on in-process 60s poller as Redis/worker fallback (+ heal missing jobs).
 */
export async function schedulePorterOrderDispatch(orderId, scheduledAt, { timezone = null } = {}) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
        throw new ValidationError('Invalid scheduledAt for dispatch job');
    }
    const delayMs = Math.max(0, when.getTime() - Date.now());
    const jobId = buildPorterScheduleJobId(orderId);
    const reminderJobId = buildPorterReminderJobId(orderId);
    const tz = normalizePorterTimezone(timezone);

    await removePorterScheduledJobs(orderId);

    const { jobId: enqueuedJobId } = await enqueueDelayedPorterJob(
        {
            action: 'PORTER_SCHEDULED_DISPATCH',
            orderMongoId: String(orderId),
            documentType: 'porter_order',
        },
        {
            delay: delayMs,
            jobId,
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
        },
        `DISPATCH ${orderId}`,
    );

    if (!enqueuedJobId) {
        const bullOn = Boolean(config.bullmqEnabled && config.redisEnabled);
        logger.warn(
            `[PorterScheduled] No bullJobId for ${orderId} (bullmqEnabled=${bullOn}). Poller will dispatch + heal when Redis recovers.`,
        );
    }

    let enqueuedReminderId = null;
    let reminderScheduledAt = null;
    const reminderEnabled = isPorterScheduleReminderEnabled();
    const reminderDelay = delayMs - PORTER_SCHEDULE_REMINDER_LEAD_MS;

    if (reminderEnabled && reminderDelay > 30_000) {
        reminderScheduledAt = new Date(when.getTime() - PORTER_SCHEDULE_REMINDER_LEAD_MS);
        const rem = await enqueueDelayedPorterJob(
            {
                action: 'PORTER_SCHEDULE_REMINDER',
                orderMongoId: String(orderId),
                documentType: 'porter_order',
            },
            {
                delay: reminderDelay,
                jobId: reminderJobId,
                removeOnComplete: true,
                removeOnFail: true,
                attempts: 2,
            },
            `REMINDER ${orderId}`,
        );
        enqueuedReminderId = rem.jobId;
        // If reminder queue failed, clear planned fields — do not invent reminderSentAt.
        if (!enqueuedReminderId) {
            reminderScheduledAt = null;
        }
    }

    const $set = {
        'schedule.status': 'scheduled',
        'schedule.bullJobId': enqueuedJobId,
        'schedule.reminderJobId': enqueuedReminderId || null,
        'schedule.reminderScheduledAt': reminderScheduledAt,
        'schedule.lastUpdatedAt': new Date(),
        'schedule.scheduledUpdatedAt': new Date(),
    };
    if (tz) $set['schedule.timezone'] = tz;

    // Never leave fake reminderSentAt; clear stale value on (re)schedule.
    await PorterOrder.updateOne(
        { _id: orderId },
        {
            $set,
            $unset: { 'schedule.reminderSentAt': 1 },
        },
    );

    return {
        jobId: enqueuedJobId,
        reminderJobId: enqueuedReminderId,
        reminderScheduledAt,
        timezone: tz,
        delayMs,
        queueAvailable: Boolean(enqueuedJobId),
    };
}

/**
 * Activate scheduled → searching_partner and start the existing dispatch engine.
 * @param {{ allowEarly?: boolean }} opts - allowEarly for admin manual start.
 */
export async function activateScheduledPorterOrder(orderId, performer = null, {
    reason = 'Scheduled dispatch activated',
    allowEarly = false,
} = {}) {
    const existing = await PorterOrder.findOne({
        _id: orderId,
        status: PORTER_ORDER_STATUS.SCHEDULED,
        ...baseFilter,
    }).select({ scheduledAt: 1, orderNumber: 1 }).lean();

    if (!existing) return null;

    if (!allowEarly && existing.scheduledAt) {
        const dueAt = new Date(existing.scheduledAt).getTime();
        if (Number.isFinite(dueAt) && dueAt > Date.now() + ACTIVATE_GRACE_MS) {
            logger.info(`[PorterScheduled] Skipping early activation for ${existing.orderNumber}`);
            return null;
        }
    }

    const now = new Date();
    const updated = await PorterOrder.findOneAndUpdate(
        {
            _id: orderId,
            status: PORTER_ORDER_STATUS.SCHEDULED,
            'dispatch.scheduledDispatchedAt': { $exists: false },
            ...baseFilter,
        },
        {
            $set: {
                status: PORTER_ORDER_STATUS.SEARCHING_PARTNER,
                'dispatch.scheduledDispatchedAt': now,
                'schedule.activatedAt': now,
                'schedule.dispatchStartedAt': now,
                'schedule.status': 'dispatching',
                'schedule.lastUpdatedAt': now,
            },
        },
        { new: true },
    );

    if (!updated) return null;

    void removePorterScheduledJobs(orderId, updated);

    appendStatusHistory(updated, updated.status, performer, reason);
    await updated.save();

    await logPorterOrderAction({
        orderId: updated._id,
        orderNumber: updated.orderNumber,
        action: 'scheduled_dispatch',
        fromStatus: PORTER_ORDER_STATUS.SCHEDULED,
        toStatus: updated.status,
        performedBy: performer,
        metadata: { reason },
    });

    await emitPorterOrderStatus(updated, updated.userId, null);

    try {
        const { notifyPorterOrderStatusChange, notifyPorterSearchingAfterSchedule } = await import('./porter-notification.service.js');
        void notifyPorterSearchingAfterSchedule(updated);
        void notifyPorterOrderStatusChange(updated, { previousStatus: PORTER_ORDER_STATUS.SCHEDULED });
    } catch {
        // non-blocking
    }

    startPorterDispatch(updated._id).catch((err) => {
        logger.warn(`[PorterScheduled] startPorterDispatch failed: ${err.message}`);
    });

    logger.info(`[PorterScheduled] Activated order ${updated.orderNumber}`);
    return updated;
}

/**
 * Re-enqueue delayed jobs for scheduled orders missing bullJobId (Redis was down at create).
 * Safe: only future schedules still waiting for dispatch.
 */
export async function healMissingPorterScheduleJobs() {
    const now = new Date();
    const queue = getOrderQueue();
    if (!queue) return { healed: 0, skipped: true };

    const orphans = await PorterOrder.find({
        status: PORTER_ORDER_STATUS.SCHEDULED,
        scheduledAt: { $gt: now },
        'dispatch.scheduledDispatchedAt': { $exists: false },
        $or: [
            { 'schedule.bullJobId': null },
            { 'schedule.bullJobId': { $exists: false } },
            { 'schedule.bullJobId': '' },
        ],
        ...baseFilter,
    })
        .select({ _id: 1, scheduledAt: 1, schedule: 1 })
        .limit(25)
        .lean();

    let healed = 0;
    for (const row of orphans) {
        try {
            const result = await schedulePorterOrderDispatch(row._id, row.scheduledAt, {
                timezone: row.schedule?.timezone || null,
            });
            if (result?.jobId) healed += 1;
        } catch (err) {
            logger.warn(`[PorterScheduled] Heal failed for ${row._id}: ${err.message}`);
        }
    }
    if (orphans.length) {
        logger.info(`[PorterScheduled] Heal scanned=${orphans.length} healed=${healed}`);
    }
    return { healed, scanned: orphans.length };
}

export async function processDueScheduledPorterOrders() {
    // First heal any future schedules still missing BullMQ jobs.
    try {
        await healMissingPorterScheduleJobs();
    } catch (err) {
        logger.warn(`[PorterScheduled] Heal pass error: ${err.message}`);
    }

    const now = new Date();
    const due = await PorterOrder.find({
        status: PORTER_ORDER_STATUS.SCHEDULED,
        scheduledAt: { $lte: now },
        'dispatch.scheduledDispatchedAt': { $exists: false },
        ...baseFilter,
    })
        .select({ _id: 1 })
        .limit(50)
        .lean();

    let activated = 0;
    for (const row of due) {
        const result = await activateScheduledPorterOrder(row._id, null, {
            reason: 'Scheduled dispatch activated (poller)',
        });
        if (result) activated += 1;
    }
    if (due.length) {
        logger.info(`[PorterScheduled] Poller due=${due.length} activated=${activated}`);
    }
    return { processed: due.length, activated };
}

export async function processPorterScheduledDispatchJob(orderMongoId) {
    if (!orderMongoId) return { processed: false };
    const order = await activateScheduledPorterOrder(orderMongoId, null, {
        reason: 'Scheduled dispatch activated (BullMQ)',
    });
    return { processed: Boolean(order) };
}

export async function processPorterScheduleReminderJob(orderMongoId) {
    if (!orderMongoId) return { processed: false };
    if (!isPorterScheduleReminderEnabled()) return { processed: false };

    const order = await PorterOrder.findOne({
        _id: orderMongoId,
        status: PORTER_ORDER_STATUS.SCHEDULED,
        'schedule.reminderSentAt': { $exists: false },
        ...baseFilter,
    });

    if (!order) return { processed: false };
    if (!order.scheduledAt || new Date(order.scheduledAt).getTime() <= Date.now()) {
        return { processed: false };
    }

    try {
        const { notifyPorterScheduleReminder } = await import('./porter-notification.service.js');
        await notifyPorterScheduleReminder(order);
    } catch (err) {
        logger.warn(`[PorterScheduled] Reminder notify failed: ${err.message}`);
        return { processed: false };
    }

    order.schedule = order.schedule || {};
    order.schedule.reminderSentAt = new Date();
    order.schedule.lastUpdatedAt = new Date();
    order.markModified('schedule');
    await order.save();

    await logPorterOrderAction({
        orderId: order._id,
        orderNumber: order.orderNumber,
        action: 'schedule_reminder_sent',
        toStatus: order.status,
        metadata: { scheduledAt: order.scheduledAt?.toISOString?.() || order.scheduledAt },
    });

    return { processed: true };
}

/**
 * Reminder poller: fire only when reminderScheduledAt has arrived
 * and the order is still scheduled (never invent early reminders).
 */
export async function processDuePorterScheduleReminders() {
    if (!isPorterScheduleReminderEnabled()) return { processed: 0, sent: 0 };

    const now = new Date();

    const due = await PorterOrder.find({
        status: PORTER_ORDER_STATUS.SCHEDULED,
        scheduledAt: { $gt: now },
        'schedule.reminderScheduledAt': { $lte: now },
        'schedule.reminderSentAt': { $exists: false },
        ...baseFilter,
    })
        .limit(50);

    let sent = 0;
    for (const order of due) {
        try {
            const { notifyPorterScheduleReminder } = await import('./porter-notification.service.js');
            await notifyPorterScheduleReminder(order);
        } catch {
            continue;
        }

        order.schedule = order.schedule || {};
        order.schedule.reminderSentAt = new Date();
        order.schedule.lastUpdatedAt = new Date();
        order.markModified('schedule');
        await order.save();
        sent += 1;

        await logPorterOrderAction({
            orderId: order._id,
            orderNumber: order.orderNumber,
            action: 'schedule_reminder_sent',
            toStatus: order.status,
            metadata: { source: 'poller' },
        });
    }
    return { processed: due.length, sent };
}
