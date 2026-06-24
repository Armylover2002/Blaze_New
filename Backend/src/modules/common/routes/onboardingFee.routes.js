import express from 'express';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../core/roles/role.middleware.js';
import {
    getPublicOnboardingFees,
    createOnboardingPaymentOrder,
    getOnboardingFeesConfig,
    updateOnboardingFeeConfig,
    getOnboardingPayments
} from '../controllers/onboardingFee.controller.js';

const router = express.Router();

// Public routes for onboarding/registration steps
router.get('/public', getPublicOnboardingFees);
router.post('/public/create-order', createOnboardingPaymentOrder);

// Admin-only management routes
router.get('/config', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), getOnboardingFeesConfig);
router.put('/config/:role', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), updateOnboardingFeeConfig);
router.get('/payments', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), getOnboardingPayments);

export default router;
