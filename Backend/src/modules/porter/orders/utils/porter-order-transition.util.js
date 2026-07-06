import { PORTER_ORDER_STATUS } from '../constants/porterOrderStatus.constants.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const TRANSITIONS = {
    [PORTER_ORDER_STATUS.CREATED]: [PORTER_ORDER_STATUS.SEARCHING_PARTNER, PORTER_ORDER_STATUS.CANCELLED_BY_USER, PORTER_ORDER_STATUS.CANCELLED_BY_ADMIN, PORTER_ORDER_STATUS.FAILED],
    [PORTER_ORDER_STATUS.SEARCHING_PARTNER]: [
        PORTER_ORDER_STATUS.ASSIGNED,
        PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
        PORTER_ORDER_STATUS.CANCELLED_BY_USER,
        PORTER_ORDER_STATUS.CANCELLED_BY_ADMIN,
        PORTER_ORDER_STATUS.CANCELLED_BY_DRIVER,
        PORTER_ORDER_STATUS.FAILED,
    ],
    [PORTER_ORDER_STATUS.ASSIGNED]: [
        PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
        PORTER_ORDER_STATUS.CANCELLED_BY_USER,
        PORTER_ORDER_STATUS.CANCELLED_BY_ADMIN,
        PORTER_ORDER_STATUS.CANCELLED_BY_DRIVER,
    ],
    [PORTER_ORDER_STATUS.PARTNER_ACCEPTED]: [
        PORTER_ORDER_STATUS.EN_ROUTE_PICKUP,
        PORTER_ORDER_STATUS.AT_PICKUP,
        PORTER_ORDER_STATUS.CANCELLED_BY_USER,
        PORTER_ORDER_STATUS.CANCELLED_BY_ADMIN,
        PORTER_ORDER_STATUS.CANCELLED_BY_DRIVER,
    ],
    [PORTER_ORDER_STATUS.EN_ROUTE_PICKUP]: [
        PORTER_ORDER_STATUS.AT_PICKUP,
        PORTER_ORDER_STATUS.CANCELLED_BY_DRIVER,
    ],
    [PORTER_ORDER_STATUS.AT_PICKUP]: [
        PORTER_ORDER_STATUS.PICKED_UP,
        PORTER_ORDER_STATUS.CANCELLED_BY_DRIVER,
    ],
    [PORTER_ORDER_STATUS.PICKED_UP]: [
        PORTER_ORDER_STATUS.IN_TRANSIT,
        PORTER_ORDER_STATUS.AT_DROP,
    ],
    [PORTER_ORDER_STATUS.IN_TRANSIT]: [PORTER_ORDER_STATUS.AT_DROP],
    [PORTER_ORDER_STATUS.AT_DROP]: [PORTER_ORDER_STATUS.DELIVERED],
    [PORTER_ORDER_STATUS.DELIVERED]: [PORTER_ORDER_STATUS.COMPLETED],
};

export const DRIVER_BUSY_STATUSES = [
    PORTER_ORDER_STATUS.ASSIGNED,
    PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
    PORTER_ORDER_STATUS.EN_ROUTE_PICKUP,
    PORTER_ORDER_STATUS.AT_PICKUP,
    PORTER_ORDER_STATUS.PICKED_UP,
    PORTER_ORDER_STATUS.IN_TRANSIT,
    PORTER_ORDER_STATUS.AT_DROP,
];

export function assertPorterStatusTransition(fromStatus, toStatus) {
    const allowed = TRANSITIONS[fromStatus];
    if (!allowed || !allowed.includes(toStatus)) {
        throw new ValidationError(`Invalid status transition: ${fromStatus} → ${toStatus}`);
    }
}

export async function getBusyPorterPartnerIds(PorterOrder) {
    const ids = await PorterOrder.distinct('dispatch.deliveryPartnerId', {
        isDeleted: { $ne: true },
        status: { $in: DRIVER_BUSY_STATUSES },
        'dispatch.deliveryPartnerId': { $ne: null },
    });
    return new Set(ids.map(String));
}

export async function assertPartnerNotBusy(PorterOrder, partnerId, excludeOrderId = null) {
    const filter = {
        isDeleted: { $ne: true },
        status: { $in: DRIVER_BUSY_STATUSES },
        'dispatch.deliveryPartnerId': partnerId,
    };
    if (excludeOrderId) filter._id = { $ne: excludeOrderId };
    const active = await PorterOrder.findOne(filter).select({ _id: 1, orderNumber: 1 }).lean();
    if (active) {
        throw new ValidationError('Complete your active parcel trip before accepting another order');
    }
}
