import axiosInstance from '@core/api/axios';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

const createGetDedupe = (requestFn) => {
  let inFlight = null;
  const deduped = (...args) => {
    if (inFlight) return inFlight;
    inFlight = Promise.resolve()
      .then(() => requestFn(...args))
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
  deduped.invalidate = () => {
    inFlight = null;
  };
  return deduped;
};

const porterDriverApi = {
  getVehicles: () => axiosInstance.get('/porter/driver/vehicles').then((response) => {
    const data = unwrap(response);
    return {
      ...data,
      vehicles: data?.vehicles || data?.driverVehicles || [],
      driverVehicles: data?.driverVehicles || data?.vehicles || [],
    };
  }),

  setActiveVehicle: (vehicleId) => axiosInstance
    .patch('/porter/driver/vehicles/active', { vehicleId })
    .then(unwrap),

  getAvailableOrders: createGetDedupe(() =>
    axiosInstance.get('/porter/driver/orders/available').then(unwrap),
  ),

  getActiveOrder: createGetDedupe(({ bustCache = false } = {}) => {
    const suffix = bustCache ? `?_=${Date.now()}` : '';
    return axiosInstance.get(`/porter/driver/orders/active${suffix}`).then(unwrap);
  }),

  acceptOrder: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/accept`).then(unwrap),

  rejectOrder: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/reject`).then(unwrap),

  cancelOrder: (orderId, reason) => axiosInstance
    .post(`/porter/driver/orders/${orderId}/cancel`, { reason })
    .then(unwrap),

  reachedPickup: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/reached-pickup`).then(unwrap),

  verifyPickupOtp: (orderId, otp) => axiosInstance
    .post(`/porter/driver/orders/${orderId}/verify-pickup-otp`, { otp })
    .then(unwrap),

  confirmPickedUp: (orderId, payload = {}) => axiosInstance
    .post(`/porter/driver/orders/${orderId}/picked-up`, payload)
    .then(unwrap),

  reachedDrop: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/reached-drop`).then(unwrap),

  createCollectQr: (orderId, body = {}) => axiosInstance
    .post(`/porter/driver/orders/${orderId}/collect-qr`, body)
    .then(unwrap),

  getPaymentStatus: (orderId) => axiosInstance
    .get(`/porter/driver/orders/${orderId}/payment-status`)
    .then(unwrap),

  completeDelivery: (orderId, payload) => axiosInstance
    .post(`/porter/driver/orders/${orderId}/complete`, payload)
    .then(unwrap),

  listTrips: (params = {}) => axiosInstance.get('/porter/driver/trips', { params }).then(unwrap),
};

/** Drop in-flight GET /active dedupe after cancel/complete so stale responses cannot restore a trip. */
export function invalidateDriverActiveOrderCache() {
  porterDriverApi.getActiveOrder.invalidate?.();
}

export default porterDriverApi;
