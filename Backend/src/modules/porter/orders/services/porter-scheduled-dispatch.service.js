import { PorterOrder } from '../models/porterOrder.model.js';
import { PORTER_ORDER_STATUS } from '../constants/porterOrderStatus.constants.js';
import { appendStatusHistory, logPorterOrderAction } from '../utils/porterOrder.helpers.js';
import { startPorterDispatch, emitPorterOrderStatus } from './porter-order-dispatch.service.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';
import { logger } from '../../../../utils/logger.js';

const baseFilter = { isDeleted: { $ne: true } };

export async function schedulePorterOrderDispatch(orderId, scheduledAt) {
    const when = new Date(scheduledAt);
    const delayMs = Math.max(0, when.getTime() - Date.now());
    const jobId = `porter-scheduled-${String(orderId)}`;

    try {
        await addOrderJob({
            action: 'PORTER_SCHEDULED_DISPATCH',
            orderMongoId: String(orderId),
            documentType: 'porter_order',
        }, {
            delay: delayMs,
            jobId,
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
        });
    } catch (err) {
        logger.warn(`[PorterScheduled] BullMQ schedule failed for ${orderId}: ${err.message}`);
    }
}

export async function activateScheduledPorterOrder(orderId, performer = null) {
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
                'dispatch.scheduledDispatchedAt': new Date(),
            },
        },
        { new: true },
    );

    if (!updated) return null;

    appendStatusHistory(updated, updated.status, performer, 'Scheduled dispatch activated');
    await updated.save();

    await logPorterOrderAction({
        orderId: updated._id,
        orderNumber: updated.orderNumber,
        action: 'scheduled_dispatch',
        fromStatus: PORTER_ORDER_STATUS.SCHEDULED,
        toStatus: updated.status,
        performedBy: performer,
    });

    await emitPorterOrderStatus(updated, updated.userId, null);
    startPorterDispatch(updated._id).catch(() => {});

    logger.info(`[PorterScheduled] Activated order ${updated.orderNumber}`);
    return updated;
}

export async function processDueScheduledPorterOrders() {
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
        const result = await activateScheduledPorterOrder(row._id);
        if (result) activated += 1;
    }
    return { processed: due.length, activated };
}

export async function processPorterScheduledDispatchJob(orderMongoId) {
    if (!orderMongoId) return { processed: false };
    const order = await activateScheduledPorterOrder(orderMongoId);
    return { processed: Boolean(order) };
}
