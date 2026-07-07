import express from 'express';
import { authMiddleware, checkPermission } from '../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../core/roles/role.middleware.js';
import { upload } from '../../../middleware/upload.js';

import {
    listZones,
    getZoneById,
    createZone,
    updateZone,
    patchZoneStatus,
    deleteZone,
    listZoneDropdown,
} from '../controllers/zone.controller.js';

import {
    listVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    patchVehicleStatus,
    deleteVehicle,
    listVehicleDropdown,
    uploadVehicleIcon,
} from '../controllers/vehicle.controller.js';

import {
    listPricing,
    getPricingById,
    getPricingByVehicleId,
    createPricing,
    updatePricing,
    patchPricingStatus,
    deletePricing,
    upsertVehiclePricing,
    clearVehiclePricing,
} from '../controllers/pricing.controller.js';

import {
    listCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    patchCouponStatus,
    deleteCoupon,
    getCouponSummary,
} from '../controllers/coupon.controller.js';

import {
    listBanners,
    getBannerById,
    createBanner,
    updateBanner,
    patchBannerStatus,
    deleteBanner,
    getBannerStats,
} from '../controllers/banner.controller.js';

import {
    listPorterUsers,
    getPorterUserById,
    updatePorterUser,
} from '../controllers/user.controller.js';

import {
    createPorterOrder,
    validatePorterCoupon,
    getActivePorterOrder,
    getPorterOrder,
    listPorterOrders,
    cancelPorterOrder,
    ratePorterOrder,
    verifyPayment,
    listPorterOrdersAdmin,
    getPorterOrderAdmin,
} from '../orders/controllers/porterOrder.controller.js';

import {
    listAvailablePorterOrders,
    getActivePorterDriverOrder,
    acceptPorterOrder,
    rejectPorterOrder,
    cancelPorterDriverOrder,
    confirmPorterReachedPickup,
    verifyPorterPickupOtp,
    confirmPorterPickedUp,
    confirmPorterReachedDrop,
    completePorterDelivery,
    createPorterCollectQr,
    getPorterPaymentStatus,
    listPorterTripHistory,
    getDriverVehicles,
    setActiveDriverVehicle,
} from '../orders/controllers/porterDriver.controller.js';

import {
    getPorterDashboard,
    getPorterReports,
    getPorterTransactions,
    getPorterWallets,
} from '../orders/controllers/porterAdminAnalytics.controller.js';

import {
    adminAssignPorterDriver,
    adminReassignPorterDriver,
    adminCancelPorterOrder,
    adminForceClosePorterOrder,
    getPorterOrderLogsAdmin,
    listAssignablePorterDrivers,
} from '../orders/controllers/porterAdminOrder.controller.js';

import { getPublicHomeData } from '../controllers/home.controller.js';
import {
    reverseGeocode,
    getPlaceDetails,
    getRoutePreview,
    getQuotePreview,
} from '../controllers/maps.controller.js';

const router = express.Router();
const adminOrEmployee = [authMiddleware, requireRoles('ADMIN', 'EMPLOYEE')];
const userAuth = [authMiddleware, requireRoles('USER')];
const driverAuth = [authMiddleware, requireRoles('DELIVERY_PARTNER')];

router.get('/health', (_req, res) => res.json({ success: true, module: 'porter', status: 'ok' }));

// Public customer endpoints
router.get('/home', getPublicHomeData);
router.get('/maps/reverse-geocode', reverseGeocode);
router.get('/maps/place-details', getPlaceDetails);
router.post('/maps/route-preview', getRoutePreview);
router.post('/maps/quote-preview', getQuotePreview);

// Customer orders
router.post('/orders', ...userAuth, createPorterOrder);
router.post('/orders/validate-coupon', ...userAuth, validatePorterCoupon);
router.get('/orders/active', ...userAuth, getActivePorterOrder);
router.get('/orders', ...userAuth, listPorterOrders);
router.post('/orders/verify-payment', ...userAuth, verifyPayment);
router.get('/orders/:id', ...userAuth, getPorterOrder);
router.post('/orders/:id/cancel', ...userAuth, cancelPorterOrder);
router.post('/orders/:id/rate', ...userAuth, ratePorterOrder);

// Driver parcel orders (isolated from Food/Quick dispatch)
router.get('/driver/vehicles', ...driverAuth, getDriverVehicles);
router.patch('/driver/vehicles/active', ...driverAuth, setActiveDriverVehicle);
router.get('/driver/orders/available', ...driverAuth, listAvailablePorterOrders);
router.get('/driver/orders/active', ...driverAuth, getActivePorterDriverOrder);
router.get('/driver/trips', ...driverAuth, listPorterTripHistory);
router.post('/driver/orders/:id/accept', ...driverAuth, acceptPorterOrder);
router.post('/driver/orders/:id/reject', ...driverAuth, rejectPorterOrder);
router.post('/driver/orders/:id/cancel', ...driverAuth, cancelPorterDriverOrder);
router.post('/driver/orders/:id/reached-pickup', ...driverAuth, confirmPorterReachedPickup);
router.post('/driver/orders/:id/verify-pickup-otp', ...driverAuth, verifyPorterPickupOtp);
router.post('/driver/orders/:id/picked-up', ...driverAuth, confirmPorterPickedUp);
router.post('/driver/orders/:id/reached-drop', ...driverAuth, confirmPorterReachedDrop);
router.post('/driver/orders/:id/collect-qr', ...driverAuth, createPorterCollectQr);
router.get('/driver/orders/:id/payment-status', ...driverAuth, getPorterPaymentStatus);
router.post('/driver/orders/:id/complete', ...driverAuth, completePorterDelivery);

// Zones
router.get('/admin/zones/dropdown', ...adminOrEmployee, checkPermission('porter::zones', 'view'), listZoneDropdown);
router.get('/admin/zones', ...adminOrEmployee, checkPermission('porter::zones', 'view'), listZones);
router.get('/admin/zones/:id', ...adminOrEmployee, checkPermission('porter::zones', 'view'), getZoneById);
router.post('/admin/zones', ...adminOrEmployee, checkPermission('porter::zones', 'create'), createZone);
router.put('/admin/zones/:id', ...adminOrEmployee, checkPermission('porter::zones', 'edit'), updateZone);
router.patch('/admin/zones/:id/status', ...adminOrEmployee, checkPermission('porter::zones', 'edit'), patchZoneStatus);
router.delete('/admin/zones/:id', ...adminOrEmployee, checkPermission('porter::zones', 'delete'), deleteZone);

// Vehicles
router.get('/admin/vehicles/dropdown', ...adminOrEmployee, checkPermission('porter::vehicles', 'view'), listVehicleDropdown);
router.get('/admin/vehicles', ...adminOrEmployee, checkPermission('porter::vehicles', 'view'), listVehicles);
router.get('/admin/vehicles/:id', ...adminOrEmployee, checkPermission('porter::vehicles', 'view'), getVehicleById);
router.post('/admin/vehicles', ...adminOrEmployee, checkPermission('porter::vehicles', 'create'), upload.single('icon'), createVehicle);
router.put('/admin/vehicles/:id', ...adminOrEmployee, checkPermission('porter::vehicles', 'edit'), upload.single('icon'), updateVehicle);
router.patch('/admin/vehicles/:id/status', ...adminOrEmployee, checkPermission('porter::vehicles', 'edit'), patchVehicleStatus);
router.post('/admin/vehicles/:id/icon', ...adminOrEmployee, checkPermission('porter::vehicles', 'edit'), upload.single('icon'), uploadVehicleIcon);
router.delete('/admin/vehicles/:id', ...adminOrEmployee, checkPermission('porter::vehicles', 'delete'), deleteVehicle);

// Pricing
router.get('/admin/pricing', ...adminOrEmployee, checkPermission('porter::pricing', 'view'), listPricing);
router.get('/admin/pricing/vehicle/:vehicleId', ...adminOrEmployee, checkPermission('porter::pricing', 'view'), getPricingByVehicleId);
router.get('/admin/pricing/:id', ...adminOrEmployee, checkPermission('porter::pricing', 'view'), getPricingById);
router.post('/admin/pricing', ...adminOrEmployee, checkPermission('porter::pricing', 'create'), createPricing);
router.put('/admin/pricing/:id', ...adminOrEmployee, checkPermission('porter::pricing', 'edit'), updatePricing);
router.put('/admin/pricing/vehicle/:vehicleId', ...adminOrEmployee, checkPermission('porter::pricing', 'edit'), upsertVehiclePricing);
router.patch('/admin/pricing/:id/status', ...adminOrEmployee, checkPermission('porter::pricing', 'edit'), patchPricingStatus);
router.delete('/admin/pricing/:id', ...adminOrEmployee, checkPermission('porter::pricing', 'delete'), deletePricing);
router.delete('/admin/pricing/vehicle/:vehicleId', ...adminOrEmployee, checkPermission('porter::pricing', 'delete'), clearVehiclePricing);

// Coupons
router.get('/admin/coupons/summary', ...adminOrEmployee, checkPermission('porter::coupons', 'view'), getCouponSummary);
router.get('/admin/coupons', ...adminOrEmployee, checkPermission('porter::coupons', 'view'), listCoupons);
router.get('/admin/coupons/:id', ...adminOrEmployee, checkPermission('porter::coupons', 'view'), getCouponById);
router.post('/admin/coupons', ...adminOrEmployee, checkPermission('porter::coupons', 'create'), createCoupon);
router.put('/admin/coupons/:id', ...adminOrEmployee, checkPermission('porter::coupons', 'edit'), updateCoupon);
router.patch('/admin/coupons/:id/status', ...adminOrEmployee, checkPermission('porter::coupons', 'edit'), patchCouponStatus);
router.delete('/admin/coupons/:id', ...adminOrEmployee, checkPermission('porter::coupons', 'delete'), deleteCoupon);

// Banners
router.get('/admin/banners/stats', ...adminOrEmployee, checkPermission('porter::banners', 'view'), getBannerStats);
router.get('/admin/banners', ...adminOrEmployee, checkPermission('porter::banners', 'view'), listBanners);
router.get('/admin/banners/:id', ...adminOrEmployee, checkPermission('porter::banners', 'view'), getBannerById);
router.post('/admin/banners', ...adminOrEmployee, checkPermission('porter::banners', 'create'), upload.single('image'), createBanner);
router.put('/admin/banners/:id', ...adminOrEmployee, checkPermission('porter::banners', 'edit'), upload.single('image'), updateBanner);
router.patch('/admin/banners/:id/status', ...adminOrEmployee, checkPermission('porter::banners', 'edit'), patchBannerStatus);
router.delete('/admin/banners/:id', ...adminOrEmployee, checkPermission('porter::banners', 'delete'), deleteBanner);

// Users (FoodUser listing)
router.get('/admin/users', ...adminOrEmployee, checkPermission('porter::users', 'view'), listPorterUsers);
router.get('/admin/users/:id', ...adminOrEmployee, checkPermission('porter::users', 'view'), getPorterUserById);
router.put('/admin/users/:id', ...adminOrEmployee, checkPermission('porter::users', 'edit'), updatePorterUser);

// Admin orders
router.get('/admin/orders', ...adminOrEmployee, checkPermission('porter::orders', 'view'), listPorterOrdersAdmin);
router.get('/admin/orders/:id', ...adminOrEmployee, checkPermission('porter::orders', 'view'), getPorterOrderAdmin);
router.get('/admin/orders/:id/logs', ...adminOrEmployee, checkPermission('porter::orders', 'view'), getPorterOrderLogsAdmin);
router.get('/admin/orders/:id/assignable-drivers', ...adminOrEmployee, checkPermission('porter::orders', 'edit'), listAssignablePorterDrivers);
router.post('/admin/orders/:id/assign', ...adminOrEmployee, checkPermission('porter::orders', 'edit'), adminAssignPorterDriver);
router.post('/admin/orders/:id/reassign', ...adminOrEmployee, checkPermission('porter::orders', 'edit'), adminReassignPorterDriver);
router.post('/admin/orders/:id/cancel', ...adminOrEmployee, checkPermission('porter::orders', 'edit'), adminCancelPorterOrder);
router.post('/admin/orders/:id/force-close', authMiddleware, requireRoles('ADMIN'), checkPermission('porter::orders', 'edit'), adminForceClosePorterOrder);

// Admin analytics
router.get('/admin/dashboard', ...adminOrEmployee, checkPermission('porter::orders', 'view'), getPorterDashboard);
router.get('/admin/reports', ...adminOrEmployee, checkPermission('porter::orders', 'view'), getPorterReports);
router.get('/admin/transactions', ...adminOrEmployee, checkPermission('porter::orders', 'view'), getPorterTransactions);
router.get('/admin/wallets', ...adminOrEmployee, checkPermission('porter::orders', 'view'), getPorterWallets);

export default router;
