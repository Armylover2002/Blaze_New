import axiosInstance from '@core/api/axios';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

const unwrapPaginated = (response) => {
  const data = unwrap(response);
  return {
    records: data.records || [],
    page: data.page || 1,
    pages: data.pages || 1,
    total: data.total || 0,
    hasNext: Boolean(data.hasNext),
    hasPrev: Boolean(data.hasPrev),
    limit: data.limit || 20,
  };
};

export const porterAdminApi = {
  // Zones
  getZones: async (params = {}) => {
    const response = await axiosInstance.get('/porter/admin/zones', { params });
    return unwrapPaginated(response);
  },
  getZoneById: async (id) => {
    const response = await axiosInstance.get(`/porter/admin/zones/${id}`);
    return unwrap(response).zone;
  },
  createZone: async (body) => {
    const response = await axiosInstance.post('/porter/admin/zones', body);
    return unwrap(response).zone;
  },
  updateZone: async (id, body) => {
    const response = await axiosInstance.put(`/porter/admin/zones/${id}`, body);
    return unwrap(response).zone;
  },
  updateZoneStatus: async (id, status) => {
    const response = await axiosInstance.patch(`/porter/admin/zones/${id}/status`, { status });
    return unwrap(response).zone;
  },
  deleteZone: async (id) => {
    const response = await axiosInstance.delete(`/porter/admin/zones/${id}`);
    return unwrap(response);
  },
  getZoneDropdown: async () => {
    const response = await axiosInstance.get('/porter/admin/zones/dropdown');
    return unwrap(response).zones || [];
  },

  // Vehicles
  getVehicles: async (params = {}) => {
    const response = await axiosInstance.get('/porter/admin/vehicles', { params });
    return unwrapPaginated(response);
  },
  getVehicleById: async (id) => {
    const response = await axiosInstance.get(`/porter/admin/vehicles/${id}`);
    return unwrap(response).vehicle;
  },
  createVehicle: async (body, file = null) => {
    if (file) {
      const formData = new FormData();
      Object.entries(body || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) formData.append(key, JSON.stringify(value));
        else formData.append(key, String(value));
      });
      formData.append('icon', file);
      const response = await axiosInstance.post('/porter/admin/vehicles', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return unwrap(response).vehicle;
    }
    const response = await axiosInstance.post('/porter/admin/vehicles', body);
    return unwrap(response).vehicle;
  },
  updateVehicle: async (id, body, file = null) => {
    if (file) {
      const formData = new FormData();
      Object.entries(body || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) formData.append(key, JSON.stringify(value));
        else formData.append(key, String(value));
      });
      formData.append('icon', file);
      const response = await axiosInstance.put(`/porter/admin/vehicles/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return unwrap(response).vehicle;
    }
    const response = await axiosInstance.put(`/porter/admin/vehicles/${id}`, body);
    return unwrap(response).vehicle;
  },
  updateVehicleStatus: async (id, status) => {
    const response = await axiosInstance.patch(`/porter/admin/vehicles/${id}/status`, { status });
    return unwrap(response).vehicle;
  },
  deleteVehicle: async (id) => {
    const response = await axiosInstance.delete(`/porter/admin/vehicles/${id}`);
    return unwrap(response);
  },
  getVehicleDropdown: async () => {
    const response = await axiosInstance.get('/porter/admin/vehicles/dropdown');
    return unwrap(response).vehicles || [];
  },

  // Pricing
  getPricingList: async (params = {}) => {
    const response = await axiosInstance.get('/porter/admin/pricing', { params });
    return unwrapPaginated(response);
  },
  upsertVehiclePricing: async (vehicleId, body) => {
    const response = await axiosInstance.put(`/porter/admin/pricing/vehicle/${vehicleId}`, body);
    return unwrap(response).pricing;
  },
  clearVehiclePricing: async (vehicleId) => {
    const response = await axiosInstance.delete(`/porter/admin/pricing/vehicle/${vehicleId}`);
    return unwrap(response);
  },

  // Coupons
  getCoupons: async (params = {}) => {
    const response = await axiosInstance.get('/porter/admin/coupons', { params });
    return unwrapPaginated(response);
  },
  getCouponById: async (id) => {
    const response = await axiosInstance.get(`/porter/admin/coupons/${id}`);
    return unwrap(response).coupon;
  },
  getCouponSummary: async () => {
    const response = await axiosInstance.get('/porter/admin/coupons/summary');
    return unwrap(response).summary || {};
  },
  createCoupon: async (body) => {
    const response = await axiosInstance.post('/porter/admin/coupons', body);
    return unwrap(response).coupon;
  },
  updateCoupon: async (id, body) => {
    const response = await axiosInstance.put(`/porter/admin/coupons/${id}`, body);
    return unwrap(response).coupon;
  },
  deleteCoupon: async (id) => {
    const response = await axiosInstance.delete(`/porter/admin/coupons/${id}`);
    return unwrap(response);
  },

  // Banners
  getBanners: async (params = {}) => {
    const response = await axiosInstance.get('/porter/admin/banners', { params });
    return unwrapPaginated(response);
  },
  getBannerStats: async () => {
    const response = await axiosInstance.get('/porter/admin/banners/stats');
    return unwrap(response).stats || {};
  },
  createBanner: async (body, file = null) => {
    const formData = new FormData();
    Object.entries(body || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      formData.append(key, String(value));
    });
    if (file) formData.append('image', file);
    const response = await axiosInstance.post('/porter/admin/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(response).banner;
  },
  updateBanner: async (id, body, file = null) => {
    const formData = new FormData();
    Object.entries(body || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      formData.append(key, String(value));
    });
    if (file) formData.append('image', file);
    const response = await axiosInstance.put(`/porter/admin/banners/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(response).banner;
  },
  deleteBanner: async (id) => {
    const response = await axiosInstance.delete(`/porter/admin/banners/${id}`);
    return unwrap(response);
  },

  // Users
  getUsers: async (params = {}) => {
    const response = await axiosInstance.get('/porter/admin/users', { params });
    return unwrapPaginated(response);
  },
  getUserById: async (id) => {
    const response = await axiosInstance.get(`/porter/admin/users/${id}`);
    return unwrap(response).user;
  },
  updateUser: async (id, body) => {
    const response = await axiosInstance.put(`/porter/admin/users/${id}`, body);
    return unwrap(response).user;
  },
  deleteUser: async (id) => {
    const response = await axiosInstance.delete(`/porter/admin/users/${id}`);
    return unwrap(response);
  },
};

export default porterAdminApi;
