import mongoose from 'mongoose';

/** Fields that require admin re-approval when an already-approved restaurant changes them. */
export const REVIEWABLE_PROFILE_FIELDS = [
    'restaurantName',
    'restaurantNameNormalized',
    'ownerName',
    'ownerEmail',
    'ownerPhone',
    'ownerPhoneDigits',
    'ownerPhoneLast10',
    'primaryContactNumber',
    'pureVegRestaurant',
    'cuisines',
    'zoneId',
    'location',
    'addressLine1',
    'addressLine2',
    'area',
    'city',
    'state',
    'pincode',
    'landmark',
    'profileImage',
    'coverImages',
    'menuImages',
    'accountHolderName',
    'accountNumber',
    'ifscCode',
    'accountType',
    'upiId',
    'upiQrImage',
    'panNumber',
    'nameOnPan',
    'panImage',
    'gstRegistered',
    'gstNumber',
    'gstLegalName',
    'gstAddress',
    'gstImage',
    'fssaiNumber',
    'fssaiExpiry',
    'fssaiImage',
    'reVerification',
];

const valuesEqual = (a, b) => {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    if (a instanceof Date || b instanceof Date) {
        const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
        const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
        return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        try {
            return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        } catch {
            return false;
        }
    }

    if (typeof a === 'object' || typeof b === 'object') {
        try {
            const normalize = (value) => {
                if (value == null) return null;
                if (value instanceof mongoose.Types.ObjectId) return String(value);
                if (value?._id) return String(value._id);
                return value;
            };
            return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
        } catch {
            return false;
        }
    }

    return String(a) === String(b);
};

export const pickLiveSnapshot = (restaurant = {}, keys = []) => {
    const snapshot = {};
    keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(restaurant, key)) {
            snapshot[key] = restaurant[key];
        }
    });
    return snapshot;
};

/**
 * Split a profile $set into:
 * - liveUpdate: applied immediately (first-time onboard OR non-reviewable fields)
 * - stagedFields: held in pendingProfileChanges.proposed for prior-approved restaurants
 */
export const splitReviewableUpdate = (restaurant, update = {}) => {
    const hadPriorApproval =
        restaurant?.wasEverApproved === true ||
        restaurant?.approvedAt != null ||
        String(restaurant?.status || '').toLowerCase() === 'approved';

    if (!hadPriorApproval) {
        return { liveUpdate: { ...update }, stagedFields: {}, shouldStage: false };
    }

    const liveUpdate = {};
    const stagedFields = {};

    Object.entries(update || {}).forEach(([key, value]) => {
        if (!REVIEWABLE_PROFILE_FIELDS.includes(key)) {
            liveUpdate[key] = value;
            return;
        }
        if (valuesEqual(restaurant?.[key], value)) {
            return;
        }
        stagedFields[key] = value;
    });

    return {
        liveUpdate,
        stagedFields,
        shouldStage: Object.keys(stagedFields).length > 0,
    };
};

export const mergePendingProfileChanges = (existingPending = {}, stagedFields = {}, restaurant = {}) => {
    const keys = Object.keys(stagedFields || {});
    if (!keys.length) return existingPending || null;

    const previousPending = existingPending && typeof existingPending === 'object' ? existingPending : {};
    const previousProposed =
        previousPending.proposed && typeof previousPending.proposed === 'object'
            ? { ...previousPending.proposed }
            : {};
    const previousSnapshot =
        previousPending.previous && typeof previousPending.previous === 'object'
            ? { ...previousPending.previous }
            : {};

    const nextProposed = { ...previousProposed, ...stagedFields };
    const nextPrevious = { ...previousSnapshot };
    keys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(nextPrevious, key)) {
            nextPrevious[key] = restaurant?.[key] ?? null;
        }
    });

    const reasons = new Set(
        Array.isArray(previousPending.changeTypes) ? previousPending.changeTypes.filter(Boolean) : []
    );
    if (keys.some((k) => ['zoneId', 'location', 'addressLine1', 'city', 'area', 'state', 'pincode', 'reVerification'].includes(k))) {
        reasons.add('location');
    }
    if (keys.some((k) => ['accountHolderName', 'accountNumber', 'ifscCode', 'accountType', 'upiId', 'upiQrImage'].includes(k))) {
        reasons.add('bank');
    }
    if (keys.some((k) => ['fssaiNumber', 'fssaiExpiry', 'fssaiImage', 'panNumber', 'panImage', 'gstNumber', 'gstImage'].includes(k))) {
        reasons.add('documents');
    }
    if (keys.some((k) => ['profileImage', 'coverImages', 'menuImages'].includes(k))) {
        reasons.add('media');
    }
    if (keys.some((k) => ['restaurantName', 'restaurantNameNormalized', 'ownerName', 'ownerEmail', 'ownerPhone', 'primaryContactNumber', 'cuisines', 'pureVegRestaurant'].includes(k))) {
        reasons.add('outlet_info');
    }

    return {
        hasPendingUpdate: true,
        proposed: nextProposed,
        previous: nextPrevious,
        changeTypes: Array.from(reasons),
        requestedAt: new Date(),
        reason: Array.from(reasons).join(', ') || 'profile_update',
    };
};

export const buildApplyPendingProfileChangesUpdate = (pending = {}) => {
    const proposed = pending?.proposed && typeof pending.proposed === 'object' ? pending.proposed : {};
    if (!Object.keys(proposed).length) {
        return {
            $unset: { pendingProfileChanges: 1, reVerification: 1 },
        };
    }

    return {
        $set: {
            ...proposed,
            status: 'approved',
            isActive: true,
            wasEverApproved: true,
            approvedAt: new Date(),
            rejectedAt: undefined,
            rejectionReason: undefined,
        },
        $unset: {
            pendingProfileChanges: 1,
            reVerification: 1,
        },
    };
};

export const buildDiscardPendingProfileChangesUpdate = () => ({
    $unset: {
        pendingProfileChanges: 1,
        reVerification: 1,
    },
});
