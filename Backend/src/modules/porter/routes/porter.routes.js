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
    deletePorterUser,
} from '../controllers/user.controller.js';

const router = express.Router();
const adminOrEmployee = [authMiddleware, requireRoles('ADMIN', 'EMPLOYEE')];

router.get('/health', (_req, res) => res.json({ success: true, module: 'porter', status: 'ok' }));

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
router.delete('/admin/users/:id', ...adminOrEmployee, checkPermission('porter::users', 'delete'), deletePorterUser);

export default router;
