import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import {
    registerRestaurantController,
    saveOnboardingStepController,
    getOnboardingDraftController,
    listApprovedRestaurantsController,
    listUnder250RestaurantsController,
    getApprovedRestaurantController,
    listPublicOffersController,
    getCurrentRestaurantController,
    updateRestaurantProfileController,
    updateRestaurantAcceptingOrdersController,
    updateCurrentRestaurantDiningSettingsController,
    uploadRestaurantProfileImageController,
    uploadRestaurantMenuImageController,
    uploadRestaurantCoverImagesController,
    uploadRestaurantMenuImagesController,
    getRestaurantComplaintsController,
    deleteRestaurantAccountController,
    getRestaurantReferralStatsController,
    getRestaurantReferralDetailsController,
    checkSubscriptionEligibilityController,
    getRestaurantCODDepositsController,
    processRestaurantCODDepositController
} from '../controllers/restaurant.controller.js';
import {
    createRestaurantSupportTicketController,
    listRestaurantSupportTicketsController
} from '../controllers/supportTicket.controller.js';
import {
    createWithdrawalRequestController,
    listMyWithdrawalsController
} from '../controllers/withdrawal.controller.js';
import {
    listCategoriesController,
    createCategoryController,
    updateCategoryController,
    deleteCategoryController,
    getCategoryStatusController
} from '../controllers/restaurantCategory.controller.js';
import { getMenuController, updateMenuController, getPublicRestaurantMenuController, getPublicMenusBatchController } from '../controllers/restaurantMenu.controller.js';
import { getPublicRestaurantAddonsController } from '../controllers/publicAddons.controller.js';
import * as feedbackExperienceController from '../../admin/controllers/feedbackExperience.controller.js';
import {
    getOutletTimingsByRestaurantIdController,
    getCurrentRestaurantOutletTimingsController,
    upsertCurrentRestaurantOutletTimingsController
} from '../controllers/outletTimings.controller.js';
import {
    createRestaurantFoodController,
    updateRestaurantFoodController
} from '../controllers/restaurantFood.controller.js';
import {
    listAddonsController,
    createAddonController,
    updateAddonController,
    deleteAddonController
} from '../controllers/restaurantAddon.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../../../../core/auth/auth.middleware.js';
import { sendError } from '../../../../utils/response.js';
import { getRestaurantFinanceController, getRestaurantSubscriptionWalletController } from '../controllers/restaurantFinance.controller.js';
import { createTopupOrderController, verifyTopupController } from '../../subscriptions/controllers/subscription.controller.js';

import {
    listRestaurantCouponsController,
    createRestaurantCouponController,
    updateRestaurantCouponController,
    deleteRestaurantCouponController
} from '../controllers/restaurantCoupon.controller.js';

import { cacheResponse, invalidateCache } from '../../../../middleware/cache.js';

const router = express.Router();

const requireRestaurant = (req, res, next) => {
    if (req.user?.role !== 'RESTAURANT') {
        return sendError(res, 403, 'Restaurant access required');
    }
    next();
};

const uploadFields = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'gstImage', maxCount: 1 },
    { name: 'fssaiImage', maxCount: 1 },
    { name: 'menuImages', maxCount: 10 }
]);

router.post('/register', uploadFields, registerRestaurantController);
router.post('/onboarding/step/:step', uploadFields, saveOnboardingStepController);
router.get('/onboarding/draft', getOnboardingDraftController);

// Public: approved restaurants list (for user app)
router.get('/menus/batch', cacheResponse(300, 'restaurant_menus_batch'), getPublicMenusBatchController);
router.get('/restaurants', cacheResponse(300, 'restaurants'), listApprovedRestaurantsController);
router.get('/restaurants/under-250', cacheResponse(300, 'restaurants_under_250'), listUnder250RestaurantsController);
router.get('/restaurants/:id', cacheResponse(600, 'restaurant_detail'), getApprovedRestaurantController);
router.get('/restaurants/:id/menu', cacheResponse(600, 'restaurant_menu'), getPublicRestaurantMenuController);
router.get('/restaurants/:id/outlet-timings', cacheResponse(600, 'restaurant_timings'), getOutletTimingsByRestaurantIdController);
router.get('/debug-counts', async (req, res) => {
    try {
        const { FoodRestaurant } = await import('../models/restaurant.model.js');
        const all = await FoodRestaurant.find({}).lean();
        res.json({
            total: all.length,
            approvedAndListed: all.filter(r => r.status === 'approved' && r.isListed).length,
            zoneMatch: all.filter(r => String(r.zoneId) === req.query.zoneId).length,
            sample: all[0]
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});
router.get('/offers', optionalAuthMiddleware, listPublicOffersController);
// Public: categories list (zone-aware; returns zone categories + global)
router.get('/categories/public', cacheResponse(600, 'categories'), listCategoriesController);

// Restaurant dashboard/profile (Bearer token + RESTAURANT role)
router.get('/current', authMiddleware, requireRestaurant, getCurrentRestaurantController);
router.patch('/profile', authMiddleware, requireRestaurant, async (req, res, next) => {
    // Invalidate caches when profile is updated
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, updateRestaurantProfileController);
router.patch('/availability', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, updateRestaurantAcceptingOrdersController);
router.patch('/dining-settings', authMiddleware, requireRestaurant, updateCurrentRestaurantDiningSettingsController);
router.get('/outlet-timings', authMiddleware, requireRestaurant, getCurrentRestaurantOutletTimingsController);
router.put('/outlet-timings', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    await invalidateCache('restaurant_timings:*');
    next();
}, upsertCurrentRestaurantOutletTimingsController);
router.get('/finance', authMiddleware, requireRestaurant, getRestaurantFinanceController);
router.get('/finance/cod-verification', authMiddleware, requireRestaurant, getRestaurantCODDepositsController);
router.post('/finance/cod-verification/:id/action', authMiddleware, requireRestaurant, upload.single('restaurantProof'), processRestaurantCODDepositController);
router.get('/subscription-eligibility', authMiddleware, requireRestaurant, checkSubscriptionEligibilityController);
router.get('/subscription-wallet', authMiddleware, requireRestaurant, getRestaurantSubscriptionWalletController);
router.post('/subscription-topup', authMiddleware, requireRestaurant, createTopupOrderController);
router.post('/verify-topup', authMiddleware, requireRestaurant, verifyTopupController);
router.post('/withdraw', authMiddleware, requireRestaurant, createWithdrawalRequestController);
router.get('/withdrawals', authMiddleware, requireRestaurant, listMyWithdrawalsController);
router.post(
    '/profile/profile-image',
    authMiddleware,
    requireRestaurant,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('restaurants:*');
        await invalidateCache('restaurant_detail:*');
        next();
    },
    uploadRestaurantProfileImageController
);
router.post(
    '/profile/menu-image',
    authMiddleware,
    requireRestaurant,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
        await invalidateCache('restaurant_menus_batch:*');
        next();
    },
    uploadRestaurantMenuImageController
);
router.post(
    '/profile/cover-images',
    authMiddleware,
    requireRestaurant,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('restaurant_detail:*');
        next();
    },
    uploadRestaurantCoverImagesController
);
router.post(
    '/profile/menu-images',
    authMiddleware,
    requireRestaurant,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
        await invalidateCache('restaurant_menus_batch:*');
        next();
    },
    uploadRestaurantMenuImagesController
);

// Categories (restaurant dashboard). Read-only for item creation, CRUD for Menu Categories page.
router.get('/categories', authMiddleware, requireRestaurant, listCategoriesController);
router.get('/categories/:id/status', authMiddleware, requireRestaurant, getCategoryStatusController);
router.post('/categories', authMiddleware, requireRestaurant, createCategoryController);
router.patch('/categories/:id', authMiddleware, requireRestaurant, updateCategoryController);
router.delete('/categories/:id', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, deleteCategoryController);

// Menu (restaurant dashboard) - only fields needed by UI
router.get('/menu', authMiddleware, requireRestaurant, getMenuController);
router.patch('/menu', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, updateMenuController);

// Feedback (restaurant dashboard)
router.post('/feedback-experience', authMiddleware, requireRestaurant, feedbackExperienceController.createFeedbackExperience);

// Public: restaurant add-ons (user app)
router.get('/restaurants/:id/addons', cacheResponse(600, 'restaurant_addons'), getPublicRestaurantAddonsController);

// Foods (restaurant creates/updates items -> stored in food_items collection)
router.post('/foods', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, createRestaurantFoodController);
router.patch('/foods/:id', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, updateRestaurantFoodController);

// Add-ons (restaurant dashboard) - approval handled by admin
router.get('/addons', authMiddleware, requireRestaurant, listAddonsController);
router.post('/addons', authMiddleware, requireRestaurant, createAddonController);
router.patch('/addons/:id', authMiddleware, requireRestaurant, updateAddonController);
router.delete('/addons/:id', authMiddleware, requireRestaurant, deleteAddonController);

// Orders (restaurant dashboard)
router.get('/orders', authMiddleware, requireRestaurant, orderController.listOrdersRestaurantController);
router.get('/orders/:orderId', authMiddleware, requireRestaurant, orderController.getOrderByIdRestaurantController);
router.patch('/orders/:orderId/status', authMiddleware, requireRestaurant, orderController.updateOrderStatusRestaurantController);
router.post('/orders/:orderId/resend-notification', authMiddleware, requireRestaurant, orderController.resendDeliveryNotificationRestaurantController);

// Complaints (restaurant dashboard)
router.get('/complaints', authMiddleware, requireRestaurant, getRestaurantComplaintsController);

// Referrals
router.get('/referral-stats', authMiddleware, requireRestaurant, getRestaurantReferralStatsController);
router.get('/referral-details', authMiddleware, requireRestaurant, getRestaurantReferralDetailsController);
router.post('/support/tickets', authMiddleware, requireRestaurant, createRestaurantSupportTicketController);
router.get('/support/tickets', authMiddleware, requireRestaurant, listRestaurantSupportTicketsController);

router.delete('/delete-account', authMiddleware, requireRestaurant, deleteRestaurantAccountController);

// Coupons (restaurant dashboard)
router.get('/coupons', authMiddleware, requireRestaurant, listRestaurantCouponsController);
router.post('/coupons', authMiddleware, requireRestaurant, createRestaurantCouponController);
router.put('/coupons/:id', authMiddleware, requireRestaurant, updateRestaurantCouponController);
router.delete('/coupons/:id', authMiddleware, requireRestaurant, deleteRestaurantCouponController);

export default router;


