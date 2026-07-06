import { sendResponse } from '../../../../utils/response.js';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import * as porterOrderService from '../services/porter-order.service.js';
import {
    createPorterOrderSchema,
    cancelPorterOrderSchema,
    ratePorterOrderSchema,
    listPorterOrdersQuerySchema,
} from '../validators/porterOrder.validator.js';
import { extractPerformer } from '../../../../core/utils/performer.js';

export const createPorterOrder = asyncHandler(async (req, res) => {
    const dto = createPorterOrderSchema.parse(req.body);
    const performer = extractPerformer(req.user);
    const order = await porterOrderService.createPorterOrder(req.user.userId, dto, performer);
    return sendResponse(res, 201, 'Porter order created successfully', { order });
});

export const getActivePorterOrder = asyncHandler(async (req, res) => {
    const order = await porterOrderService.getActivePorterOrderForUser(req.user.userId);
    return sendResponse(res, 200, 'Active order fetched', { order });
});

export const verifyPayment = asyncHandler(async (req, res) => {
    const result = await porterOrderService.verifyPorterPayment(req.user.userId, req.body);
    return sendResponse(res, 200, 'Payment verified successfully', result);
});

export const getPorterOrder = asyncHandler(async (req, res) => {
    const order = await porterOrderService.getPorterOrderForUser(req.user.userId, req.params.id);
    return sendResponse(res, 200, 'Order fetched', { order });
});

export const listPorterOrders = asyncHandler(async (req, res) => {
    const query = listPorterOrdersQuerySchema.parse(req.query);
    const result = await porterOrderService.listPorterOrdersForUser(req.user.userId, query);
    return sendResponse(res, 200, 'Orders fetched', result);
});

export const cancelPorterOrder = asyncHandler(async (req, res) => {
    const { reason } = cancelPorterOrderSchema.parse(req.body);
    const performer = extractPerformer(req.user);
    const order = await porterOrderService.cancelPorterOrderByUser(
        req.user.userId,
        req.params.id,
        reason || 'Cancelled by user',
        performer,
    );
    return sendResponse(res, 200, 'Order cancelled', { order });
});

export const ratePorterOrder = asyncHandler(async (req, res) => {
    const dto = ratePorterOrderSchema.parse(req.body);
    const order = await porterOrderService.ratePorterOrder(req.user.userId, req.params.id, dto);
    return sendResponse(res, 200, 'Rating submitted', { order });
});

// Admin
export const listPorterOrdersAdmin = asyncHandler(async (req, res) => {
    const query = listPorterOrdersQuerySchema.parse(req.query);
    const result = await porterOrderService.listPorterOrdersAdmin(query);
    return sendResponse(res, 200, 'Orders fetched', result);
});

export const getPorterOrderAdmin = asyncHandler(async (req, res) => {
    const order = await porterOrderService.getPorterOrderAdmin(req.params.id);
    return sendResponse(res, 200, 'Order fetched', { order });
});
