import { sendResponse } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import * as bannerService from '../services/banner.service.js';

export const listBanners = asyncHandler(async (req, res) => {
    const data = await bannerService.listBanners(req.query);
    return sendResponse(res, 200, 'Banners fetched successfully', data);
});

export const getBannerById = asyncHandler(async (req, res) => {
    const banner = await bannerService.getBannerById(req.params.id);
    return sendResponse(res, 200, 'Banner fetched successfully', { banner });
});

export const createBanner = asyncHandler(async (req, res) => {
    const banner = await bannerService.createBanner(req.body, req.user, req.file);
    return sendResponse(res, 201, 'Banner created successfully', { banner });
});

export const updateBanner = asyncHandler(async (req, res) => {
    const banner = await bannerService.updateBanner(req.params.id, req.body, req.user, req.file);
    return sendResponse(res, 200, 'Banner updated successfully', { banner });
});

export const patchBannerStatus = asyncHandler(async (req, res) => {
    const banner = await bannerService.updateBannerStatus(req.params.id, req.body, req.user);
    return sendResponse(res, 200, 'Banner status updated successfully', { banner });
});

export const deleteBanner = asyncHandler(async (req, res) => {
    const result = await bannerService.deleteBanner(req.params.id, req.user);
    return sendResponse(res, 200, 'Banner deleted successfully', result);
});

export const getBannerStats = asyncHandler(async (req, res) => {
    const stats = await bannerService.getBannerStats();
    return sendResponse(res, 200, 'Banner stats fetched successfully', { stats });
});
