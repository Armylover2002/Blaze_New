import express from "express";
import { authMiddleware } from "../../../../core/auth/auth.middleware.js";
import { requireRoles } from "../../../../core/roles/role.middleware.js";
import { upload } from "../../../../middleware/upload.js";
import {
  adjustSellerStockController,
  approveSellerReturnController,
  createSellerProductController,
  deleteSellerProductController,
  getSellerCategoryTreeController,
  getSellerEarningsController,
  getSellerNotificationsController,
  getSellerOrdersController,
  getSellerProductByIdController,
  getSellerProductsController,
  getSellerProfileController,
  getSellerReturnsController,
  getSellerStatsController,
  getSellerStockHistoryController,
  markAllSellerNotificationsReadController,
  markSellerNotificationReadController,
  rejectSellerReturnController,
  requestSellerReturnPickupController,
  resendSellerOrderDispatchController,
  requestSellerOtpController,
  requestSellerWithdrawalController,
  updateSellerOrderStatusController,
  updateSellerProductController,
  updateSellerProfileController,
  verifySellerOtpController,
  listSellerCouponsController,
  createSellerCouponController,
  updateSellerCouponController,
  deleteSellerCouponController,
  deleteSellerAccountController,
  getSellerCODDepositsController,
  processSellerCODDepositController,
  browseSellerCatalogController,
  lookupProductBySkuController,
  bulkUploadSellerProductsController,
} from "../controllers/seller.controller.js";

const router = express.Router();
const sellerOnly = [authMiddleware, requireRoles("SELLER")];
const productUpload = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 8 },
]);
const sellerProfileUpload = upload.fields([
  { name: "upiQrImage", maxCount: 1 },
  { name: "shopLicenseImage", maxCount: 1 },
  { name: "medicalLicenseImage", maxCount: 1 },
  { name: "fssaiImage", maxCount: 1 },
]);

router.post("/auth/request-otp", requestSellerOtpController);
router.post("/auth/verify-otp", verifySellerOtpController);

router.get("/categories/tree", ...sellerOnly, getSellerCategoryTreeController);

router.get("/products", ...sellerOnly, getSellerProductsController);
router.get("/products/:productId", ...sellerOnly, getSellerProductByIdController);

// Catalog browsing & SKU lookup (read-only, no seller info exposed)
router.get("/catalog/browse", ...sellerOnly, browseSellerCatalogController);
router.get("/catalog/lookup", ...sellerOnly, lookupProductBySkuController);
router.post("/products", ...sellerOnly, productUpload, createSellerProductController);
router.post("/products/bulk", ...sellerOnly, upload.single("csvFile"), bulkUploadSellerProductsController);
router.put(
  "/products/:productId",
  ...sellerOnly,
  productUpload,
  updateSellerProductController,
);
router.delete("/products/:productId", ...sellerOnly, deleteSellerProductController);

router.get("/stock-history", ...sellerOnly, getSellerStockHistoryController);
router.post("/stock-adjustments", ...sellerOnly, adjustSellerStockController);

router.get("/profile", ...sellerOnly, getSellerProfileController);
router.put(
  "/profile",
  ...sellerOnly,
  sellerProfileUpload,
  updateSellerProfileController,
);
router.delete("/profile", ...sellerOnly, deleteSellerAccountController);

router.get("/notifications", ...sellerOnly, getSellerNotificationsController);
router.put(
  "/notifications/mark-all-read",
  ...sellerOnly,
  markAllSellerNotificationsReadController,
);
router.put(
  "/notifications/:notificationId/read",
  ...sellerOnly,
  markSellerNotificationReadController,
);

router.get("/orders", ...sellerOnly, getSellerOrdersController);
router.put("/orders/:orderId/status", ...sellerOnly, updateSellerOrderStatusController);
router.post("/orders/:orderId/resend-dispatch", ...sellerOnly, resendSellerOrderDispatchController);

router.get("/returns", ...sellerOnly, getSellerReturnsController);
router.put("/returns/:orderId/approve", ...sellerOnly, approveSellerReturnController);
router.put("/returns/:orderId/reject", ...sellerOnly, rejectSellerReturnController);
router.post("/returns/:orderId/request-pickup", ...sellerOnly, requestSellerReturnPickupController);

router.get("/earnings", ...sellerOnly, getSellerEarningsController);
router.post("/withdrawals", ...sellerOnly, requestSellerWithdrawalController);
router.get("/stats", ...sellerOnly, getSellerStatsController);

router.get("/coupons", ...sellerOnly, listSellerCouponsController);
router.post("/coupons", ...sellerOnly, createSellerCouponController);
router.put("/coupons/:id", ...sellerOnly, updateSellerCouponController);
router.delete("/coupons/:id", ...sellerOnly, deleteSellerCouponController);

// COD Deposit Verification routes
router.get("/finance/cod-verification", ...sellerOnly, getSellerCODDepositsController);
router.post("/finance/cod-verification/:id/action", ...sellerOnly, upload.single("sellerProof"), processSellerCODDepositController);

export default router;
