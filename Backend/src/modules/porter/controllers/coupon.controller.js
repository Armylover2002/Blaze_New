import { sendResponse } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import * as couponService from '../services/coupon.service.js';

export const listCoupons = asyncHandler(async (req, res) => {
    const data = await couponService.listCoupons(req.query);
    return sendResponse(res, 200, 'Coupons fetched successfully', data);
});

export const getCouponById = asyncHandler(async (req, res) => {
    const coupon = await couponService.getCouponById(req.params.id);
    return sendResponse(res, 200, 'Coupon fetched successfully', { coupon });
});

export const createCoupon = asyncHandler(async (req, res) => {
    const coupon = await couponService.createCoupon(req.body, req.user);
    return sendResponse(res, 201, 'Coupon created successfully', { coupon });
});

export const updateCoupon = asyncHandler(async (req, res) => {
    const coupon = await couponService.updateCoupon(req.params.id, req.body, req.user);
    return sendResponse(res, 200, 'Coupon updated successfully', { coupon });
});

export const patchCouponStatus = asyncHandler(async (req, res) => {
    const coupon = await couponService.updateCouponStatus(req.params.id, req.body, req.user);
    return sendResponse(res, 200, 'Coupon status updated successfully', { coupon });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
    const result = await couponService.deleteCoupon(req.params.id, req.user);
    return sendResponse(res, 200, 'Coupon deleted successfully', result);
});

export const getCouponSummary = asyncHandler(async (req, res) => {
    const summary = await couponService.getCouponSummary();
    return sendResponse(res, 200, 'Coupon summary fetched successfully', { summary });
});
