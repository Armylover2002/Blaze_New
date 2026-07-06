import axiosInstance from '@core/api/axios';
import { getWithDedupe } from '@core/api/dedupe';

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

  getQuotePreview: ({ pickup, delivery, vehicleId }) => axiosInstance
    .post('/porter/maps/quote-preview', { pickup, delivery, vehicleId })
    .then(unwrap),
};

export default porterUserApi;
