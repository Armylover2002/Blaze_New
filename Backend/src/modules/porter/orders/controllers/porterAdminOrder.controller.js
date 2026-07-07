import { sendResponse } from '../../../../utils/response.js';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import { extractPerformer } from '../../../../core/utils/performer.js';
import * as adminOrderService from '../services/porter-admin-order.service.js';
import {
    adminAssignDriverSchema,
    adminCancelOrderSchema,
    adminForceCloseSchema,
} from '../validators/porterOrder.validator.js';

export const adminAssignPorterDriver = asyncHandler(async (req, res) => {
    const { driverId } = adminAssignDriverSchema.parse(req.body);
    const performer = extractPerformer(req.user);
    const order = await adminOrderService.adminAssignPorterDriver(req.params.id, driverId, performer);
    return sendResponse(res, 200, 'Driver assigned', { order });
});

export const adminReassignPorterDriver = asyncHandler(async (req, res) => {
    const { driverId } = adminAssignDriverSchema.parse(req.body);
    const performer = extractPerformer(req.user);
    const order = await adminOrderService.adminReassignPorterDriver(req.params.id, driverId, performer);
    return sendResponse(res, 200, 'Driver reassigned', { order });
});

export const adminCancelPorterOrder = asyncHandler(async (req, res) => {
    const { reason, note } = adminCancelOrderSchema.parse(req.body);
    const performer = extractPerformer(req.user);
    const order = await adminOrderService.adminCancelPorterOrder(req.params.id, reason, performer, note || null);
    return sendResponse(res, 200, 'Order cancelled', { order });
});

export const adminForceClosePorterOrder = asyncHandler(async (req, res) => {
    const dto = adminForceCloseSchema.parse(req.body);
    const performer = extractPerformer(req.user);
    const order = await adminOrderService.adminForceClosePorterOrder(req.params.id, dto, performer);
    return sendResponse(res, 200, 'Order force closed', { order });
});

export const getPorterOrderLogsAdmin = asyncHandler(async (req, res) => {
    const logs = await adminOrderService.getPorterOrderLogsAdmin(req.params.id);
    return sendResponse(res, 200, 'Order logs fetched', logs);
});

export const listAssignablePorterDrivers = asyncHandler(async (req, res) => {
    const drivers = await adminOrderService.listAssignablePorterDrivers(req.params.id);
    return sendResponse(res, 200, 'Assignable drivers fetched', { drivers });
});
