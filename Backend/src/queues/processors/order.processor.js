import { logger } from '../../utils/logger.js';

/**
 * BullMQ processor for order lifecycle jobs.
 *
 * Current implementation is intentionally logging-only to avoid changing API behavior.
 * @param {import('bullmq').Job} job
 */
export const processOrderJob = async (job) => {
    const data = job?.data || {};
    const action = data.action || 'unknown';
    const orderId = data.orderId || '';
    const orderMongoId = data.orderMongoId || '';

    logger.info(
        `[BullMQ:order] action=${action} jobId=${job.id} orderId=${orderId} orderMongoId=${orderMongoId}`
    );

    // Handle Smart Dispatch Timeout
    if (action === 'DISPATCH_TIMEOUT_CHECK') {
        try {
            const { processDispatchTimeout } = await import('../../modules/food/orders/services/order.service.js');
            // Pass full data object to allow attempt count and other options
            await processDispatchTimeout(orderMongoId, data.partnerId, data);
        } catch (err) {
            logger.error(`[BullMQ:order] DISPATCH_TIMEOUT_CHECK failed: ${err.message}`);
        }
    }

    // Handle Scheduled Order Activation (PRIMARY path — T−lead delayed job)
    if (action === 'NOTIFY_SCHEDULED_ORDER') {
        const { processScheduledOrderNotification } = await import('../../modules/food/orders/services/order.service.js');
        const result = await processScheduledOrderNotification(orderMongoId, {
            source: 'bullmq',
        });
        // Already activated / cancelled → ack job (no retry spam when Redis returns)
        if (result?.alreadyHandled) {
            logger.info(
                `[BullMQ:order] NOTIFY_SCHEDULED_ORDER skipped (alreadyHandled) orderMongoId=${orderMongoId}`
            );
            return { processed: true, action, jobId: job.id, skipped: true };
        }
        if (!result?.success) {
            throw new Error(result?.reason || 'NOTIFY_SCHEDULED_ORDER failed');
        }
    }

    // Food Quick Delivery SLA compensation (wallet / pending refund)
    if (action === 'QUICK_SLA_COMPENSATE') {
        const { processQuickSlaCompensation } = await import(
            '../../modules/food/orders/services/quick-sla.service.js'
        );
        const result = await processQuickSlaCompensation(orderMongoId);
        if (!result?.success && !result?.alreadyHandled) {
            throw new Error(result?.reason || 'QUICK_SLA_COMPENSATE failed');
        }
        return { processed: true, action, jobId: job.id, ...result };
    }

    // Porter scheduled dispatch
    if (action === 'PORTER_SCHEDULED_DISPATCH') {
        try {
            const { processPorterScheduledDispatchJob } = await import('../../modules/porter/orders/services/porter-scheduled-dispatch.service.js');
            await processPorterScheduledDispatchJob(orderMongoId);
        } catch (err) {
            logger.error(`[BullMQ:order] PORTER_SCHEDULED_DISPATCH failed: ${err.message}`);
        }
    }

    // Porter schedule reminder (~15 min before)
    if (action === 'PORTER_SCHEDULE_REMINDER') {
        try {
            const { processPorterScheduleReminderJob } = await import('../../../modules/porter/orders/services/porter-scheduled-dispatch.service.js');
            await processPorterScheduleReminderJob(orderMongoId);
        } catch (err) {
            logger.error(`[BullMQ:order] PORTER_SCHEDULE_REMINDER failed: ${err.message}`);
        }
    }

    return { processed: true, action, jobId: job.id };
};
