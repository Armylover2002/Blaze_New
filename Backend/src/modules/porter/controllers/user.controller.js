import { sendResponse } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import * as userService from '../services/user.service.js';

export const listPorterUsers = asyncHandler(async (req, res) => {
    const data = await userService.listPorterUsers(req.query);
    return sendResponse(res, 200, 'Users fetched successfully', data);
});

export const getPorterUserById = asyncHandler(async (req, res) => {
    const user = await userService.getPorterUserById(req.params.id);
    return sendResponse(res, 200, 'User fetched successfully', { user });
});
