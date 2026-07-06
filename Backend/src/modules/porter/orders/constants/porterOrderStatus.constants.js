export const PORTER_ORDER_STATUS = {
    CREATED: 'created',
    SCHEDULED: 'scheduled',
    SEARCHING_PARTNER: 'searching_partner',
    ASSIGNED: 'assigned',
    PARTNER_ACCEPTED: 'partner_accepted',
    EN_ROUTE_PICKUP: 'en_route_pickup',
    AT_PICKUP: 'at_pickup',
    PICKED_UP: 'picked_up',
    IN_TRANSIT: 'in_transit',
    AT_DROP: 'at_drop',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    CANCELLED_BY_USER: 'cancelled_by_user',
    CANCELLED_BY_ADMIN: 'cancelled_by_admin',
    CANCELLED_BY_DRIVER: 'cancelled_by_driver',
    FAILED: 'failed',
};

export const PORTER_DISPATCH_STATUS = {
    UNASSIGNED: 'unassigned',
    ASSIGNED: 'assigned',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
};

export const PORTER_DELIVERY_PHASE = {
    EN_ROUTE_PICKUP: 'en_route_pickup',
    AT_PICKUP: 'at_pickup',
    PICKED_UP: 'picked_up',
    EN_ROUTE_DROP: 'en_route_drop',
    AT_DROP: 'at_drop',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
};

export const PORTER_PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
};

export const PORTER_PAYMENT_METHODS = ['wallet', 'cash', 'razorpay'];

export const PORTER_TERMINAL_STATUSES = new Set([
    PORTER_ORDER_STATUS.COMPLETED,
    PORTER_ORDER_STATUS.CANCELLED_BY_USER,
    PORTER_ORDER_STATUS.CANCELLED_BY_ADMIN,
    PORTER_ORDER_STATUS.CANCELLED_BY_DRIVER,
    PORTER_ORDER_STATUS.FAILED,
]);

export const PORTER_ACTIVE_STATUSES = new Set([
    PORTER_ORDER_STATUS.SCHEDULED,
    PORTER_ORDER_STATUS.SEARCHING_PARTNER,
    PORTER_ORDER_STATUS.ASSIGNED,
    PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
    PORTER_ORDER_STATUS.EN_ROUTE_PICKUP,
    PORTER_ORDER_STATUS.AT_PICKUP,
    PORTER_ORDER_STATUS.PICKED_UP,
    PORTER_ORDER_STATUS.IN_TRANSIT,
    PORTER_ORDER_STATUS.AT_DROP,
    PORTER_ORDER_STATUS.DELIVERED,
]);
