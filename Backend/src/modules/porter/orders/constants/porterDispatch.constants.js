export const PORTER_DISPATCH_DOCUMENT_TYPE = 'porter_order';

export const PORTER_SOCKET_EVENTS = {
    ORDER_AVAILABLE: 'porter_order_available',
    ORDER_STATUS: 'porter_order_status',
    ORDER_CANCELLED: 'porter_order_cancelled',
    ORDER_CLAIMED: 'porter_order_claimed',
    PLAY_SOUND: 'porter_play_notification_sound',
    ADMIN_ORDER_UPDATE: 'porter_admin_order_update',
};

export const PORTER_DISPATCH_RADII_KM = [3, 5, 8, 12, 20];

export const PORTER_SERVICE_KEY = 'parcel';
