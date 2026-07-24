import axiosInstance from "@core/api/axios";
import { getWithDedupe } from "@core/api/dedupe";

const normalizeResponse = (response) => {
  const payload =
    response?.data?.result ??
    response?.data?.results ??
    response?.data?.data ??
    null;

  return {
    ...response,
    data: {
      ...response.data,
      result: payload,
      results: payload,
    },
  };
};

const call = (request) => request.then(normalizeResponse);

export const sellerApi = {
  requestOtp: (phone) =>
    call(axiosInstance.post("/seller/auth/request-otp", { phone })),

  getTerms: () => call(axiosInstance.get("/food/pages/terms?role=seller")),

  verifyOtp: (phone, otp) =>
    call(axiosInstance.post("/seller/auth/verify-otp", { phone, otp })),

  getProducts: (params = {}) =>
    call(axiosInstance.get("/seller/products", { params })),

  getProductById: (productId) =>
    call(axiosInstance.get(`/seller/products/${String(productId)}`)),

  createProduct: (formData) =>
    call(
      axiosInstance.post("/seller/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ),

  bulkUploadProducts: (formData) =>
    call(
      axiosInstance.post("/seller/products/bulk", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ),

  updateProduct: (productId, formData) =>
    call(
      axiosInstance.put(`/seller/products/${String(productId)}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ),

  deleteProduct: (productId) =>
    call(axiosInstance.delete(`/seller/products/${String(productId)}`)),

  getCategoryTree: () => call(axiosInstance.get("/seller/categories/tree")),

  getStats: (range = "daily") =>
    call(axiosInstance.get("/seller/stats", { params: { range } })),

  // In-flight + short TTL coalesce StrictMode/remount duplicate GETs.
  // Pass { forceRefresh: true } after mutations or intentional polls.
  getOrders: (params = {}, options = {}) =>
    call(
      getWithDedupe("/seller/orders", params, {
        contextModule: "seller",
        ttl: 2500,
        ...options,
      }),
    ),

  updateOrderStatus: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/orders/${String(orderId)}/status`, data),
    ),

  resendOrderDispatch: (orderId) =>
    call(axiosInstance.post(`/seller/orders/${String(orderId)}/resend-dispatch`)),

  getEarnings: () => call(axiosInstance.get("/seller/earnings")),

  getProfile: (options = {}) =>
    call(
      getWithDedupe("/seller/profile", {}, {
        contextModule: "seller",
        ttl: 5000,
        ...options,
      }),
    ),

  getQuickZonesPublic: () => call(getWithDedupe("/quick-commerce/zones/public")),

  updateProfile: (data = {}) =>
    call(
      axiosInstance.put("/seller/profile", data, data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined),
    ),

  adjustStock: (data = {}) =>
    call(axiosInstance.post("/seller/stock-adjustments", data)),

  getStockHistory: () => call(axiosInstance.get("/seller/stock-history")),

  getNotifications: () => call(axiosInstance.get("/seller/notifications")),

  markNotificationRead: (id) =>
    call(axiosInstance.put(`/seller/notifications/${String(id)}/read`)),

  markAllNotificationsRead: () =>
    call(axiosInstance.put("/seller/notifications/mark-all-read")),

  requestWithdrawal: (data = {}) =>
    call(axiosInstance.post("/seller/withdrawals", data)),

  getReturns: () => call(axiosInstance.get("/seller/returns")),

  approveReturn: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/returns/${String(orderId)}/approve`, data),
    ),

  rejectReturn: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/returns/${String(orderId)}/reject`, data),
    ),

  requestReturnPickup: (orderId) =>
    call(
      axiosInstance.post(`/seller/returns/${String(orderId)}/request-pickup`),
    ),

  getCoupons: () => call(axiosInstance.get("/seller/coupons")),
  createCoupon: (data = {}) => call(axiosInstance.post("/seller/coupons", data)),
  updateCoupon: (couponId, data = {}) => call(axiosInstance.put(`/seller/coupons/${String(couponId)}`, data)),
  deleteCoupon: (couponId) => call(axiosInstance.delete(`/seller/coupons/${String(couponId)}`)),
  deleteAccount: () => call(axiosInstance.delete("/seller/profile")),
  getCODDeposits: () => call(axiosInstance.get("/seller/finance/cod-verification")),
  processCODDeposit: (id, formData) =>
    call(
      axiosInstance.post(`/seller/finance/cod-verification/${String(id)}/action`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ),

  // Product catalog browser — lists other sellers' products (no seller info)
  browseProductCatalog: (params = {}) =>
    call(axiosInstance.get("/seller/catalog/browse", { params })),

  // Lookup a product by its SKU/Product ID for auto-fill
  lookupProductBySku: (sku) =>
    call(axiosInstance.get("/seller/catalog/lookup", { params: { sku } })),
};

export default sellerApi;
