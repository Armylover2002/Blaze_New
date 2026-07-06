import { sendResponse } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import * as homeService from '../services/home.service.js';

export const getPublicHomeData = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    const data = await homeService.getPublicHomeData();
    return sendResponse(res, 200, 'Porter home data fetched successfully', data);
});
