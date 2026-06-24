export const RETURN_STATUS = {
  REQUESTED: 'return_requested',
  APPROVED: 'return_approved',
  REJECTED: 'return_rejected',
  PICKUP_ASSIGNED: 'return_pickup_assigned',
  IN_TRANSIT: 'return_in_transit',
  RETURNED: 'returned',
  REFUND_COMPLETED: 'refund_completed',
  CANCELLED: 'return_cancelled',
};

export const mapReturnStatusLabel = (status) => {
  switch (status) {
    case RETURN_STATUS.REQUESTED:
      return 'Return Requested';
    case RETURN_STATUS.APPROVED:
      return 'Approved';
    case RETURN_STATUS.REJECTED:
      return 'Rejected';
    case RETURN_STATUS.PICKUP_ASSIGNED:
      return 'Pickup Assigned';
    case RETURN_STATUS.IN_TRANSIT:
      return 'Rider Coming';
    case RETURN_STATUS.RETURNED:
      return 'Reached Seller';
    case RETURN_STATUS.REFUND_COMPLETED:
      return 'Refund Completed';
    case RETURN_STATUS.CANCELLED:
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
};

export const RETURN_TIMELINE_STEPS = [
  { id: 'return_requested', label: 'Return Requested' },
  { id: 'return_approved', label: 'Approved' },
  { id: 'return_pickup_assigned', label: 'Pickup Assigned' },
  { id: 'return_in_transit', label: 'Rider Coming' },
  { id: 'picked_up', label: 'Picked Up' },
  { id: 'reached_seller', label: 'Reached Seller' },
  { id: 'quality_check', label: 'Quality Check' },
  { id: 'refund_processing', label: 'Refund Processing' },
  { id: 'refund_completed', label: 'Refund Completed' },
];

const STATUS_RANK = {
  return_requested: 0,
  return_approved: 1,
  return_pickup_assigned: 2,
  return_in_transit: 3,
  picked_up: 4,
  returned: 5,
  refund_processing: 6,
  refund_completed: 7,
  return_rejected: -1,
  return_cancelled: -1,
};

export const resolveReturnTimelineIndex = (returnDoc = {}) => {
  const status = String(returnDoc?.returnStatus || '').trim();
  const refundStatus = String(returnDoc?.refundStatus || '').trim();
  const deliveryStatus = String(returnDoc?.deliveryState?.status || '').trim();
  const quality = String(returnDoc?.qualityCheck?.status || '').trim();

  if (status === RETURN_STATUS.REJECTED || status === RETURN_STATUS.CANCELLED) return -1;
  if (refundStatus === 'completed' || status === RETURN_STATUS.REFUND_COMPLETED) return 8;
  if (refundStatus === 'processing' || refundStatus === 'pending') return 7;
  if (quality === 'passed' || status === RETURN_STATUS.RETURNED) return 6;
  if (deliveryStatus === 'picked_up') return 4;
  if (status === RETURN_STATUS.IN_TRANSIT) return 3;
  if (status === RETURN_STATUS.PICKUP_ASSIGNED) return 2;
  if (status === RETURN_STATUS.APPROVED) return 1;
  return STATUS_RANK[status] ?? 0;
};

export const isReturnPickupTrip = (order = {}) =>
  String(order?.tripType || '').trim() === 'return_pickup' ||
  String(order?.documentType || '').trim() === 'seller_return';

export const getDeliveryDocumentId = (order = {}) => {
  if (isReturnPickupTrip(order)) {
    return String(order?.returnId || order?.orderMongoId || order?._id || order?.id || '');
  }
  return String(order?.orderId || order?.orderMongoId || order?._id || order?.id || '');
};
