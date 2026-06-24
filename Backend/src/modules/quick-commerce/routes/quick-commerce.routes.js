import express from "express";
import faqRoutes from "./faq.routes.js";
import { upload } from "../../../middleware/upload.js";
import {
  getCategories,
  getCoupons,
  applyCoupon,
  getHomeData,
  getBootstrapData,
  getExperienceSectionsLean,
  getHeroConfigLean,
  getOfferSectionsLean,
  getOffers,
  getProductById,
  getProductReviews,
  submitProductReview,
  getProducts,
  getStoreDetails,
} from "../controllers/catalog.controller.js";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../controllers/cart.controller.js";
import {
  cancelOrder,
  getMyOrders,
  getOrderById,
  placeOrder,
  verifyPayment,
  submitOrderRatingsController,
} from "../controllers/order.controller.js";
import {
  cancelReturnRequestController,
  createReturnRequestController,
  getAdminReturnByIdController,
  getReturnFinanceReportController,
  getReturnPickupOtpController,
  getReturnStatusController,
  getSellerFinanceLedgerController,
  listAdminReturnsController,
  passReturnQualityCheckController,
  confirmReturnPayoutController,
  processAdminReturnRefundController,
} from "../controllers/return.controller.js";
import { getUserWalletController } from "../../food/user/controllers/userWallet.controller.js";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  toggleWishlist,
} from "../controllers/wishlist.controller.js";
import {
  createSupportTicketController,
  listMySupportTicketsController,
  getAdminSupportTicketsController,
  updateAdminSupportTicketController,
} from "../controllers/support.controller.js";
import {
  approveAdminSellerRequest,
  getAdminSellerRequests,
  createCategory,
  createProduct,
  getAdminCategories,
  getAdminOrders,
  getAdminOrderById,
  getAdminCustomers,
  getAdminCustomerById,
  deleteAdminOrder,
  getAdminProducts,
  getAdminProductById,
  getAdminStats,
  rejectAdminSellerRequest,
  removeCategory,
  removeProduct,
  updateCategory,
  updateProduct,
  getAdminZones,
  getAdminZoneById,
  createAdminZone,
  updateAdminZone,
  deleteAdminZone,
  listPublicZones,
  getAdminExperienceSections,
  createAdminExperienceSection,
  updateAdminExperienceSection,
  deleteAdminExperienceSection,
  reorderAdminExperienceSections,
  getAdminHeroConfig,
  setAdminHeroConfig,
  getAdminOfferSections,
  createAdminOfferSection,
  updateAdminOfferSection,
  deleteAdminOfferSection,
  reorderAdminOfferSections,
  getAdminFinanceSummary,
  getAdminFinanceLedger,
  getAdminFinancePayouts,
  getAdminSellerWithdrawals,
  getAdminSellerTransactions,
  updateAdminWithdrawalStatus,
  getAdminCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getAdminQuickZoneSellersController,
  assignAdminQuickZoneHubsController,
  getAdminSellerCODVerificationsController,
  settleSellerCODVerificationController,
} from "../controllers/admin.controller.js";
import {
  getSellerCommissionBootstrap,
  getSellerCommissions,
  getSellerCommissionById,
  createSellerCommission,
  updateSellerCommission,
  deleteSellerCommission,
  toggleSellerCommissionStatus,
} from "../controllers/adminCommission.controller.js";
import {
  createDeliveryCommissionRule,
  createOrUpdateFeeSettings,
  deleteDeliveryCommissionRule,
  getDeliveryCommissionRules,
  getFeeSettings,
  getPublicBillingSettings,
  toggleDeliveryCommissionRuleStatus,
  updateDeliveryCommissionRule,
} from "../controllers/billing.controller.js";
import * as notificationBroadcastController from "../../food/admin/controllers/notificationBroadcast.controller.js";
import {
  geocodeAddress,
  reverseGeocode,
} from "../controllers/location.controller.js";

import { authMiddleware, checkPermission } from "../../../core/auth/auth.middleware.js";
import { requireRoles } from "../../../core/roles/role.middleware.js";
import { verifyAccessToken } from "../../../core/auth/token.util.js";

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = { userId: decoded.userId, role: decoded.role };
    } catch (e) {
      // ignore guest
    }
  }
  next();
};

const router = express.Router();
const adminOnly = [authMiddleware, requireRoles("ADMIN")];
const adminOrEmployee = [authMiddleware, requireRoles("ADMIN", "EMPLOYEE")];

router.get("/health", (_req, res) =>
  res.json({ success: true, module: "quick-commerce", status: "ok" }),
);

// ─── Performance: Single bootstrap call for homepage ──────────────────────────────
router.get("/bootstrap", getBootstrapData);

router.get("/home", getHomeData);
// Lean dedicated endpoints (replaces heavy getHomeData bridges)
router.get("/experience", getExperienceSectionsLean);
router.get("/experience/hero", getHeroConfigLean);
router.get("/offer-sections", getOfferSectionsLean);
router.get("/offers", getOffers);
router.get("/coupons", getCoupons);
router.post("/coupons/apply", applyCoupon);
router.get("/categories", getCategories);
router.get("/products", getProducts);
router.get("/products/:productId/reviews", getProductReviews);
router.post("/products/reviews", optionalAuth, submitProductReview);
router.get("/products/:productId", getProductById);
router.get("/zones/public", listPublicZones);
router.get("/billing/settings", getPublicBillingSettings);
router.get("/stores/:storeId", getStoreDetails);

// Location endpoints
router.get("/location/geocode", geocodeAddress);
router.get("/location/reverse-geocode", reverseGeocode);

router.get("/cart", optionalAuth, getCart);
router.post("/cart/add", optionalAuth, addToCart);
router.put("/cart/update", optionalAuth, updateCartItem);
router.delete("/cart/remove/:productId", optionalAuth, removeCartItem);
router.delete("/cart/clear", optionalAuth, clearCart);

router.post("/orders", optionalAuth, placeOrder);
router.get("/orders", optionalAuth, getMyOrders);
router.get("/orders/:orderId", optionalAuth, getOrderById);
router.post("/orders/:orderId/verify-payment", optionalAuth, verifyPayment);
router.post("/orders/:orderId/cancel", optionalAuth, cancelOrder);
router.post("/orders/:orderId/returns", authMiddleware, createReturnRequestController);
router.get("/orders/:orderId/returns", authMiddleware, getReturnStatusController);
router.get("/orders/:orderId/returns/pickup-otp", authMiddleware, getReturnPickupOtpController);
router.post("/orders/:orderId/returns/cancel", authMiddleware, cancelReturnRequestController);
router.patch("/orders/:orderId/ratings", authMiddleware, submitOrderRatingsController);
router.get("/wallet/balance", authMiddleware, getUserWalletController);
router.get("/wallet/transactions", authMiddleware, getUserWalletController);
router.post("/support/ticket", optionalAuth, createSupportTicketController);
router.get("/support/my-tickets", optionalAuth, listMySupportTicketsController);

router.get("/wishlist", optionalAuth, getWishlist);
router.post("/wishlist/add", optionalAuth, addToWishlist);
router.delete("/wishlist/remove/:productId", optionalAuth, removeFromWishlist);
router.post("/wishlist/toggle", optionalAuth, toggleWishlist);

// Admin endpoints (quick-commerce dashboard)
router.get("/admin/stats", ...adminOrEmployee, checkPermission("quick", "view"), getAdminStats);
router.get("/admin/categories", ...adminOrEmployee, checkPermission("quick::core_management::categories", "view"), getAdminCategories);
router.post(
  "/admin/categories",
  ...adminOrEmployee,
  checkPermission("quick::core_management::categories", "create"),
  upload.single("image"),
  createCategory,
);
router.put(
  "/admin/categories/:categoryId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::categories", "edit"),
  upload.single("image"),
  updateCategory,
);
router.delete("/admin/categories/:categoryId", ...adminOrEmployee, checkPermission("quick::core_management::categories", "delete"), removeCategory);
router.get("/admin/products", ...adminOrEmployee, checkPermission("quick::core_management::products", "view"), getAdminProducts);
router.get("/admin/products/:productId", ...adminOrEmployee, checkPermission("quick::core_management::products", "view"), getAdminProductById);
router.post(
  "/admin/products",
  ...adminOrEmployee,
  checkPermission("quick::core_management::products", "create"),
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 8 },
  ]),
  createProduct,
);
router.put(
  "/admin/products/:productId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::products", "edit"),
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 8 },
  ]),
  updateProduct,
);
router.delete("/admin/products/:productId", ...adminOrEmployee, checkPermission("quick::core_management::products", "delete"), removeProduct);
router.get("/admin/orders", ...adminOrEmployee, checkPermission("quick::core_management::orders", "view"), getAdminOrders);
router.get("/admin/orders/:orderId", ...adminOrEmployee, checkPermission("quick::core_management::orders", "view"), getAdminOrderById);
router.delete("/admin/orders/:orderId", ...adminOrEmployee, checkPermission("quick::core_management::orders", "delete"), deleteAdminOrder);

router.get(
  "/admin/returns",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "view"),
  listAdminReturnsController,
);
router.get(
  "/admin/returns/:returnId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "view"),
  getAdminReturnByIdController,
);
router.post(
  "/admin/returns/:returnId/refund",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "edit"),
  processAdminReturnRefundController,
);
router.post(
  "/admin/returns/:returnId/quality-pass",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "edit"),
  passReturnQualityCheckController,
);
router.post(
  "/admin/returns/:returnId/confirm-payout",
  ...adminOrEmployee,
  checkPermission("quick::core_management::wallet", "edit"),
  confirmReturnPayoutController,
);
router.get(
  "/admin/finance/returns/report",
  ...adminOrEmployee,
  checkPermission("quick::core_management::wallet", "view"),
  getReturnFinanceReportController,
);
router.get(
  "/admin/finance/sellers/:sellerId/ledger",
  ...adminOrEmployee,
  checkPermission("quick::core_management::wallet", "view"),
  getSellerFinanceLedgerController,
);

// Finance (quick-commerce admin wallet & ledger)
router.get("/admin/finance/summary", ...adminOrEmployee, checkPermission("quick::core_management::wallet", "view"), getAdminFinanceSummary);
router.get("/admin/finance/ledger", ...adminOrEmployee, checkPermission("quick::core_management::wallet", "view"), getAdminFinanceLedger);
router.get("/admin/finance/payouts", ...adminOrEmployee, checkPermission("quick::core_management::wallet", "view"), getAdminFinancePayouts);
router.get(
  "/admin/withdrawals/sellers",
  ...adminOrEmployee,
  checkPermission("quick::core_management::withdrawals", "view"),
  getAdminSellerWithdrawals,
);
router.get(
  "/admin/seller-transactions",
  ...adminOrEmployee,
  checkPermission("quick::core_management::seller_payments", "view"),
  getAdminSellerTransactions,
);

router.patch(
  "/admin/withdrawals/:withdrawalId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::withdrawals", "edit"),
  updateAdminWithdrawalStatus,
);


// Quick Sellers COD Deposit Verification
router.get(
  "/admin/sellers/cod-verification",
  ...adminOrEmployee,
  checkPermission("quick::core_management::cash_collection", "view"),
  getAdminSellerCODVerificationsController,
);
router.post(
  "/admin/sellers/cod-verification/:id/action",
  ...adminOrEmployee,
  checkPermission("quick::core_management::cash_collection", "edit"),
  settleSellerCODVerificationController,
);
router.get("/admin/customers", ...adminOrEmployee, checkPermission("quick::core_management::customers", "view"), getAdminCustomers);
router.get("/admin/customers/:id", ...adminOrEmployee, checkPermission("quick::core_management::customers", "view"), getAdminCustomerById);
router.get(
  "/admin/support-tickets",
  ...adminOrEmployee,
  checkPermission("quick::core_management::customer_support::tickets", "view"),
  getAdminSupportTicketsController,
);
router.patch(
  "/admin/support-tickets/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::customer_support::tickets", "edit"),
  updateAdminSupportTicketController,
);
router.get("/admin/seller-requests", ...adminOrEmployee, checkPermission("quick::core_management::seller_requests", "view"), getAdminSellerRequests);
router.put(
  "/admin/seller-requests/:sellerId/approve",
  ...adminOrEmployee,
  checkPermission("quick::core_management::seller_requests", "edit"),
  approveAdminSellerRequest,
);
router.put(
  "/admin/seller-requests/:sellerId/reject",
  ...adminOrEmployee,
  checkPermission("quick::core_management::seller_requests", "edit"),
  rejectAdminSellerRequest,
);
router.get("/admin/zones", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "view"), getAdminZones);
router.get("/admin/zones/:zoneId", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "view"), getAdminZoneById);
router.post("/admin/zones", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "create"), createAdminZone);
router.patch("/admin/zones/:zoneId", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "edit"), updateAdminZone);
router.delete("/admin/zones/:zoneId", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "delete"), deleteAdminZone);

// Quick Zone Hub Setup
router.get(
  "/admin/quick-zone-hubs/sellers/:zoneId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::zone_setup", "view"),
  getAdminQuickZoneSellersController,
);
router.post(
  "/admin/quick-zone-hubs",
  ...adminOrEmployee,
  checkPermission("quick::core_management::zone_setup", "edit"),
  assignAdminQuickZoneHubsController,
);

// Experience Sections Management
router.get(
  "/admin/experience/sections",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "view"),
  getAdminExperienceSections,
);
router.post(
  "/admin/experience/sections",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  createAdminExperienceSection,
);
router.put(
  "/admin/experience/sections/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  updateAdminExperienceSection,
);
router.delete(
  "/admin/experience/sections/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  deleteAdminExperienceSection,
);
router.post(
  "/admin/experience/sections/reorder",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  reorderAdminExperienceSections,
);

router.get("/admin/experience/hero", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::hero_categories", "view"), getAdminHeroConfig);
router.post("/admin/experience/hero", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::hero_categories", "edit"), setAdminHeroConfig);

// Offer Sections Management
router.get("/admin/offer-sections", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::offer_sections", "view"), getAdminOfferSections);
router.post("/admin/offer-sections", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"), createAdminOfferSection);
router.put("/admin/offer-sections/:id", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"), updateAdminOfferSection);
router.delete(
  "/admin/offer-sections/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  deleteAdminOfferSection,
);
router.post(
  "/admin/offer-sections/reorder",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  reorderAdminOfferSections,
);

// Broadcast Notifications
router.post(
  "/admin/notifications/broadcast",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::notifications", "create"),
  notificationBroadcastController.createBroadcastNotificationController
);
router.get(
  "/admin/notifications/broadcast",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::notifications", "view"),
  notificationBroadcastController.getBroadcastNotificationsController
);
router.delete(
  "/admin/notifications/broadcast/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::notifications", "delete"),
  notificationBroadcastController.deleteBroadcastNotificationController
);

// Seller Commission Management
router.get(
  "/admin/seller-commissions/bootstrap",
  ...adminOrEmployee,
  checkPermission("quick::core_management::sellers::commission", "view"),
  getSellerCommissionBootstrap,
);
router.get("/admin/seller-commissions", ...adminOrEmployee, checkPermission("quick::core_management::sellers::commission", "view"), getSellerCommissions);
router.get(
  "/admin/seller-commissions/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::sellers::commission", "view"),
  getSellerCommissionById,
);
router.post("/admin/seller-commissions", ...adminOrEmployee, checkPermission("quick::core_management::sellers::commission", "create"), createSellerCommission);
router.put(
  "/admin/seller-commissions/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::sellers::commission", "edit"),
  updateSellerCommission,
);
router.delete(
  "/admin/seller-commissions/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::sellers::commission", "delete"),
  deleteSellerCommission,
);
router.patch(
  "/admin/seller-commissions/:id/toggle-status",
  ...adminOrEmployee,
  checkPermission("quick::core_management::sellers::commission", "edit"),
  toggleSellerCommissionStatus,
);
router.get("/admin/fee-settings", ...adminOrEmployee, checkPermission("quick::core_management::billing", "view"), getFeeSettings);
router.put("/admin/fee-settings", ...adminOrEmployee, checkPermission("quick::core_management::billing", "edit"), createOrUpdateFeeSettings);
router.get(
  "/admin/delivery/commission-rules",
  ...adminOrEmployee,
  checkPermission("quick::core_management::billing", "view"),
  getDeliveryCommissionRules,
);
router.post(
  "/admin/delivery/commission-rules",
  ...adminOrEmployee,
  checkPermission("quick::core_management::billing", "edit"),
  createDeliveryCommissionRule,
);
router.patch(
  "/admin/delivery/commission-rules/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::billing", "edit"),
  updateDeliveryCommissionRule,
);
router.delete(
  "/admin/delivery/commission-rules/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::billing", "delete"),
  deleteDeliveryCommissionRule,
);
router.patch(
  "/admin/delivery/commission-rules/:id/status",
  ...adminOrEmployee,
  checkPermission("quick::core_management::billing", "edit"),
  toggleDeliveryCommissionRuleStatus,
);

// Admin Coupon Management
router.get('/admin/coupons', ...adminOrEmployee, checkPermission('quick::core_management::promotions_management::coupons', 'view'), getAdminCoupons);
router.post('/admin/coupons', ...adminOrEmployee, checkPermission('quick::core_management::promotions_management::coupons', 'create'), createCoupon);
router.put('/admin/coupons/:couponId', ...adminOrEmployee, checkPermission('quick::core_management::promotions_management::coupons', 'edit'), updateCoupon);
router.delete('/admin/coupons/:couponId', ...adminOrEmployee, checkPermission('quick::core_management::promotions_management::coupons', 'delete'), deleteCoupon);
router.patch('/admin/coupons/:couponId/toggle-status', ...adminOrEmployee, checkPermission('quick::core_management::promotions_management::coupons', 'edit'), toggleCouponStatus);
router.use(faqRoutes);

export default router;
