import { getOrderQueue } from '../index.js';
import { logger } from '../../utils/logger.js';

/**
 * Add an order processing job to the queue. No-op if BullMQ is disabled.
 * @param {object} data - Job data (e.g. { orderId, action })
 * @param {object} [options] - BullMQ job options override
 * @returns {Promise<import('bullmq').Job | null>}
 */
export const addOrderJob = async (data, options = {}) => {
    const queue = getOrderQueue();
    if (!queue) {
        const action = data?.action || 'unknown';
        const documentType = data?.documentType || 'forward_order';
        const targetId = data?.orderMongoId || data?.orderId || '';
        logger.warn(
            `[BullMQ] Order queue unavailable — job not added (action=${action}, documentType=${documentType}, targetId=${targetId}). Start Redis and the order worker to enable DISPATCH_TIMEOUT_CHECK retries.`,
        );
        return null;
    }
    try {
        const job = await queue.add('process-order', data, options);
        logger.info(`Order job added: ${job.id}`);
        return job;
    } catch (err) {
        logger.error(`Failed to add order job: ${err.message}`);
        throw err;
    }
};
