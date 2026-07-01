import { PorterCoupon } from '../models/porterCoupon.model.js';
import { logger } from '../../../utils/logger.js';
import {
    SYSTEM_PERFORMER,
    buildStatusHistoryEntry,
    computeLifecycleStatus,
} from '../utils/coupon-lifecycle.helpers.js';

const baseFilter = { isDeleted: { $ne: true } };

const RECONCILE_BATCH_SIZE = 500;

/**
 * Reconcile stored statuses with the lifecycle for all non-inactive coupons.
 * Uses bulkWrite() with conditional filters to avoid duplicate/racy updates.
 */
export async function bulkUpdateCouponStatuses(now = new Date()) {
    const candidates = await PorterCoupon.find({
        ...baseFilter,
        status: { $ne: 'inactive' },
    })
        .select({ _id: 1, status: 1, validFrom: 1, validUntil: 1 })
        .limit(RECONCILE_BATCH_SIZE)
        .lean();

    const operations = [];
    const transitions = {
        scheduledToActive: 0,
        scheduledToExpired: 0,
        activeToExpired: 0,
        activeToScheduled: 0,
        expiredToActive: 0,
        expiredToScheduled: 0,
    };

    candidates.forEach((doc) => {
        const nextStatus = computeLifecycleStatus(doc.validFrom, doc.validUntil, now);
        if (doc.status === nextStatus) return;

        const key = `${doc.status}To${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`;
        if (transitions[key] !== undefined) {
            transitions[key] += 1;
        }

        operations.push({
            updateOne: {
                filter: { _id: doc._id, status: doc.status },
                update: {
                    $set: { status: nextStatus },
                    $push: {
                        statusHistory: buildStatusHistoryEntry(
                            doc.status,
                            nextStatus,
                            SYSTEM_PERFORMER,
                            now,
                        ),
                    },
                },
            },
        });
    });

    if (!operations.length) {
        return { modified: 0, ...transitions };
    }

    const result = await PorterCoupon.bulkWrite(operations, { ordered: false });
    const modified = result.modifiedCount || 0;

    if (modified > 0) {
        logger.info(`Porter coupon lifecycle: reconciled ${modified} coupon(s)`);
    }

    return { modified, ...transitions };
}
