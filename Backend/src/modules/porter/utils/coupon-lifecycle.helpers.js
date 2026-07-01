import { ValidationError } from '../../../core/auth/errors.js';

export const COUPON_STATUSES = Object.freeze(['scheduled', 'active', 'inactive', 'expired']);

/** System performer for automatic lifecycle transitions. */
export const SYSTEM_PERFORMER = Object.freeze({
    userId: null,
    name: 'System',
    email: '',
    phone: '',
    role: 'system',
    roleName: 'System',
    actionAt: new Date(),
});

/**
 * Compute lifecycle status from validity window.
 * Admin-disabled coupons must pass explicitStatus === 'inactive'.
 */
export const computeLifecycleStatus = (validFrom, validUntil, now = new Date(), explicitStatus) => {
    if (explicitStatus === 'inactive') {
        return 'inactive';
    }

    const fromMs = new Date(validFrom).getTime();
    const untilMs = new Date(validUntil).getTime();
    const nowMs = now.getTime();

    if (Number.isNaN(fromMs) || Number.isNaN(untilMs)) {
        throw new ValidationError('Invalid coupon validity dates');
    }

    if (untilMs < nowMs) return 'expired';
    if (fromMs > nowMs) return 'scheduled';
    return 'active';
};

/**
 * Resolve stored status on create/update.
 * Only `inactive` is a manual admin override. All other client statuses mean "enabled"
 * and the lifecycle is computed from validity dates.
 */
export const resolveCouponStatusForSave = ({
    validFrom,
    validUntil,
    currentStatus,
    requestedStatus,
    now = new Date(),
}) => {
    if (requestedStatus === 'inactive') {
        return 'inactive';
    }

    if (currentStatus === 'inactive' && requestedStatus === undefined) {
        return 'inactive';
    }

    return computeLifecycleStatus(validFrom, validUntil, now);
};

/**
 * Validate that an explicit status is consistent with validity dates.
 */
export const validateStatusCombination = (status, validFrom, validUntil, now = new Date()) => {
    if (!COUPON_STATUSES.includes(status)) {
        throw new ValidationError('Invalid coupon status');
    }

    if (status === 'inactive') return;

    const fromMs = new Date(validFrom).getTime();
    const untilMs = new Date(validUntil).getTime();
    const nowMs = now.getTime();

    if (status === 'scheduled' && fromMs <= nowMs) {
        throw new ValidationError('Scheduled coupon cannot have a start date in the past');
    }

    if (status === 'active' && (fromMs > nowMs || untilMs < nowMs)) {
        throw new ValidationError('Active coupon must be within its validity window');
    }

    if (status === 'expired' && untilMs >= nowMs) {
        throw new ValidationError('Expired coupon cannot have a current or future end date');
    }

    const computed = computeLifecycleStatus(validFrom, validUntil, now);

    if (status === 'scheduled' && computed !== 'scheduled') {
        throw new ValidationError('Coupon cannot be scheduled with the given validity dates');
    }

    if (status === 'expired' && computed !== 'expired') {
        throw new ValidationError('Coupon cannot be expired with the given validity dates');
    }

    if (status === 'active' && computed !== 'active') {
        throw new ValidationError('Coupon cannot be active with the given validity dates');
    }
};

/**
 * Prevent invalid lifecycle transitions when admin explicitly sets a non-inactive status.
 */
export const validateStatusTransition = (currentStatus, nextStatus, validFrom, validUntil, now = new Date()) => {
    if (nextStatus === 'inactive' || currentStatus === nextStatus) return;

    if (currentStatus === 'expired' && nextStatus === 'scheduled') {
        throw new ValidationError('Expired coupon cannot become scheduled');
    }

    validateStatusCombination(nextStatus, validFrom, validUntil, now);
};

export const buildStatusHistoryEntry = (oldStatus, newStatus, changedBy, changedAt = new Date()) => ({
    oldStatus: oldStatus ?? null,
    newStatus,
    status: newStatus,
    changedAt,
    changedBy,
});

export const appendStatusHistoryIfChanged = (doc, oldStatus, newStatus, changedBy) => {
    if (oldStatus === newStatus) return false;
    doc.statusHistory.push(buildStatusHistoryEntry(oldStatus, newStatus, changedBy));
    return true;
};

/**
 * Redemption guard — status must be active and within validity window.
 */
export const validateCouponForRedemption = (coupon, now = new Date()) => {
    if (!coupon) {
        throw new ValidationError('Coupon not found');
    }

    const status = String(coupon.status || '').toLowerCase();
    if (status !== 'active') {
        throw new ValidationError('Coupon is not active');
    }

    const fromMs = new Date(coupon.validFrom).getTime();
    const untilMs = new Date(coupon.validUntil).getTime();
    const nowMs = now.getTime();

    if (nowMs < fromMs || nowMs > untilMs) {
        throw new ValidationError('Coupon is not valid at this time');
    }

    return true;
};
