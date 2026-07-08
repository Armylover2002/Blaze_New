import { sendResponse } from '../../../../utils/response.js';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import * as driverOrderService from '../services/porter-driver-order.service.js';
import { setDeliveryPartnerActiveVehicle } from '../../../food/delivery/services/delivery.service.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { getDeliveryPartnerVehiclePayload } from '../services/porter-driver-vehicle.service.js';
import { porterOtpSchema, porterCompleteDeliverySchema } from '../validators/porterOrder.validator.js';
import { extractPerformer } from '../../../../core/utils/performer.js';
import { NotFoundError, ValidationError } from '../../../../core/auth/errors.js';

export const listAvailablePorterOrders = asyncHandler(async (req, res) => {
    const orders = await driverOrderService.listAvailablePorterOrdersForDriver(req.user.userId);
    return sendResponse(res, 200, 'Available parcel orders', { orders, module: 'parcel' });
});

export const getActivePorterDriverOrder = asyncHandler(async (req, res) => {
    const order = await driverOrderService.getActivePorterOrderForDriver(req.user.userId);
    return sendResponse(res, 200, 'Active parcel order', { order });
});

export const acceptPorterOrder = asyncHandler(async (req, res) => {
    const performer = extractPerformer(req.user);
    const order = await driverOrderService.acceptPorterOrder(req.user.userId, req.params.id, performer);
    return sendResponse(res, 200, 'Parcel order accepted', { order });
});

export const rejectPorterOrder = asyncHandler(async (req, res) => {
    await driverOrderService.rejectPorterOrder(req.user.userId, req.params.id);
    return sendResponse(res, 200, 'Order rejected', { rejected: true });
});

export const cancelPorterDriverOrder = asyncHandler(async (req, res) => {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) throw new ValidationError('Cancellation reason is required');
    const performer = extractPerformer(req.user);
    const result = await driverOrderService.cancelPorterOrderByDriver(req.user.userId, req.params.id, reason, performer);
    return sendResponse(res, 200, 'Order cancelled', result);
});

export const confirmPorterReachedPickup = asyncHandler(async (req, res) => {
    const performer = extractPerformer(req.user);
    const order = await driverOrderService.confirmPorterReachedPickup(req.user.userId, req.params.id, performer);
    return sendResponse(res, 200, 'Reached pickup', { order });
});

export const verifyPorterPickupOtp = asyncHandler(async (req, res) => {
    const { otp } = porterOtpSchema.parse(req.body);
    const performer = extractPerformer(req.user);
    await driverOrderService.verifyPorterPickupOtp(req.user.userId, req.params.id, otp, performer);
    return sendResponse(res, 200, 'Pickup OTP verified', { verified: true });
});

export const confirmPorterPickedUp = asyncHandler(async (req, res) => {
    const performer = extractPerformer(req.user);
    const pickupPhotoUrl = req.body?.pickupPhotoUrl || null;
    const order = await driverOrderService.confirmPorterPickedUp(req.user.userId, req.params.id, performer, pickupPhotoUrl);
    return sendResponse(res, 200, 'Picked up', { order });
});

export const createPorterCollectQr = asyncHandler(async (req, res) => {
    const result = await driverOrderService.createPorterOrderCollectQr(
        req.user.userId,
        req.params.id,
        { name: req.body?.name, phone: req.body?.phone, email: req.body?.email },
    );
    return sendResponse(res, 200, 'Collect QR created', result);
});

export const getPorterPaymentStatus = asyncHandler(async (req, res) => {
    const result = await driverOrderService.getPorterOrderPaymentStatus(req.user.userId, req.params.id);
    return sendResponse(res, 200, 'Payment status', result);
});

export const confirmPorterReachedDrop = asyncHandler(async (req, res) => {
    const performer = extractPerformer(req.user);
    const order = await driverOrderService.confirmPorterReachedDrop(req.user.userId, req.params.id, performer);
    return sendResponse(res, 200, 'Reached drop', { order });
});

export const completePorterDelivery = asyncHandler(async (req, res) => {
    const { deliveryPhotoUrl } = porterCompleteDeliverySchema.parse(req.body);
    const performer = extractPerformer(req.user);
    const order = await driverOrderService.completePorterDelivery(
        req.user.userId,
        req.params.id,
        deliveryPhotoUrl,
        performer,
    );
    return sendResponse(res, 200, 'Delivery completed', { order });
});

export const listPorterTripHistory = asyncHandler(async (req, res) => {
    const data = await driverOrderService.listPorterTripHistoryForDriver(req.user.userId, req.query);
    return sendResponse(res, 200, 'Parcel trip history', data);
});

export const getDriverVehicles = asyncHandler(async (req, res) => {
    const partner = await FoodDeliveryPartner.findById(req.user.userId).lean();
    if (!partner) throw new NotFoundError('Delivery partner not found');

    const payload = await getDeliveryPartnerVehiclePayload(partner);
    return sendResponse(res, 200, 'Driver vehicles fetched', payload);
});

export const setActiveDriverVehicle = asyncHandler(async (req, res) => {
    const { vehicleId } = req.body || {};
    if (!vehicleId) throw new ValidationError('vehicleId is required');
    const data = await setDeliveryPartnerActiveVehicle(req.user.userId, vehicleId);
    return sendResponse(res, 200, 'Active vehicle updated', data);
});
