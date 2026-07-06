import axiosInstance from '@core/api/axios';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

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

  getAvailableOrders: () => axiosInstance.get('/porter/driver/orders/available').then(unwrap),

  getActiveOrder: () => axiosInstance.get('/porter/driver/orders/active').then(unwrap),

  acceptOrder: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/accept`).then(unwrap),

  rejectOrder: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/reject`).then(unwrap),

  reachedPickup: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/reached-pickup`).then(unwrap),

  verifyPickupOtp: (orderId, otp) => axiosInstance
    .post(`/porter/driver/orders/${orderId}/verify-pickup-otp`, { otp })
    .then(unwrap),

  confirmPickedUp: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/picked-up`).then(unwrap),

  reachedDrop: (orderId) => axiosInstance.post(`/porter/driver/orders/${orderId}/reached-drop`).then(unwrap),

  completeDelivery: (orderId, otp) => axiosInstance
    .post(`/porter/driver/orders/${orderId}/complete`, { otp })
    .then(unwrap),

  listTrips: (params = {}) => axiosInstance.get('/porter/driver/trips', { params }).then(unwrap),
};

export default porterDriverApi;
