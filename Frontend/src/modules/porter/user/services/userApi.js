import axiosInstance from '@core/api/axios';
import { getWithDedupe, invalidateCache } from '@core/api/dedupe';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

const porterUserApi = {
  getHomeData: (options = {}) => getWithDedupe('/porter/home', {}, options).then(unwrap),

  reverseGeocode: (lat, lng, options = {}) => axiosInstance
    .get('/porter/maps/reverse-geocode', { params: { lat, lng }, signal: options.signal })
    .then(unwrap),

  getPlaceDetails: (placeId) => axiosInstance
    .get('/porter/maps/place-details', { params: { placeId } })
    .then(unwrap),

  getRoutePreview: (pickup, delivery) => axiosInstance
    .post('/porter/maps/route-preview', { pickup, delivery })
    .then(unwrap),

  getQuotePreview: ({ pickup, delivery, vehicleId, parcelWeight }) => axiosInstance
    .post('/porter/maps/quote-preview', { pickup, delivery, vehicleId, parcelWeight })
    .then(unwrap),

  createOrder: (payload, options = {}) => axiosInstance
    .post('/porter/orders', payload, { signal: options.signal })
    .then((response) => {
      invalidateCache('/porter/orders/active');
      return unwrap(response);
    }),

  validateCoupon: (payload) => axiosInstance
    .post('/porter/orders/validate-coupon', payload)
    .then(unwrap),

  getActiveOrder: (options = {}) => getWithDedupe('/porter/orders/active', {}, options).then(unwrap),

  verifyPayment: (payload) => axiosInstance
    .post('/porter/orders/verify-payment', payload)
    .then(unwrap),

  getOrder: (id, options = {}) => getWithDedupe(`/porter/orders/${id}`, {}, options).then(unwrap),

  listOrders: (params = {}, options = {}) => getWithDedupe('/porter/orders', params, options).then(unwrap),

  cancelOrder: (id, reason) => axiosInstance
    .post(`/porter/orders/${id}/cancel`, { reason })
    .then(unwrap),

  rateOrder: (id, payload) => axiosInstance
    .post(`/porter/orders/${id}/rate`, payload)
    .then(unwrap),
};

export default porterUserApi;
