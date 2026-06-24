import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import { QuickOrder } from '../models/order.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { getActiveFeeSettings } from '../admin/services/billing.service.js';
import {
  RETURN_OTP_MAX_ATTEMPTS,
  RETURN_OTP_TTL_MS,
  RETURN_TRIP_TYPE,
  DISPATCH_DOCUMENT_TYPES,
} from '../utils/dispatchDocument.constants.js';
import { generateReturnOtp } from './return.helpers.js';

const num = (value) => Number(value || 0);

export const stampReturnOtps = (returnDoc) => {
  const expiresAt = new Date(Date.now() + RETURN_OTP_TTL_MS);
  returnDoc.customerOtp = generateReturnOtp();
  returnDoc.sellerOtp = generateReturnOtp();
  returnDoc.customerOtpExpiresAt = expiresAt;
  returnDoc.sellerOtpExpiresAt = expiresAt;
  returnDoc.customerOtpAttempts = 0;
  returnDoc.sellerOtpAttempts = 0;
  return returnDoc;
};

export const verifyReturnOtp = ({
  returnDoc,
  role,
  otp,
  incrementOnFailure = true,
}) => {
  const normalizedOtp = String(otp || '').trim();
  if (!normalizedOtp) throw new ValidationError('OTP is required');

  const isCustomer = role === 'customer';
  const field = isCustomer ? 'customerOtp' : 'sellerOtp';
  const expiresField = isCustomer ? 'customerOtpExpiresAt' : 'sellerOtpExpiresAt';
  const attemptsField = isCustomer ? 'customerOtpAttempts' : 'sellerOtpAttempts';

  const expected = String(returnDoc?.[field] || '').trim();
  const expiresAt = returnDoc?.[expiresField] ? new Date(returnDoc[expiresField]) : null;
  const attempts = num(returnDoc?.[attemptsField]);

  if (!expected) throw new ValidationError('OTP is not configured for this return');
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    throw new ValidationError('OTP has expired');
  }
  if (attempts >= RETURN_OTP_MAX_ATTEMPTS) {
    throw new ValidationError('Maximum OTP attempts exceeded');
  }

  if (expected !== normalizedOtp) {
    if (incrementOnFailure) {
      returnDoc[attemptsField] = attempts + 1;
    }
    throw new ValidationError('Invalid OTP');
  }

  return true;
};

const resolveCoords = (locationLike) => {
  if (!locationLike) return null;
  if (Array.isArray(locationLike?.coordinates) && locationLike.coordinates.length >= 2) {
    return { lng: Number(locationLike.coordinates[0]), lat: Number(locationLike.coordinates[1]) };
  }
  const lat = Number(locationLike?.lat ?? locationLike?.latitude);
  const lng = Number(locationLike?.lng ?? locationLike?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
};

export const loadReturnPickupContext = async (returnDoc) => {
  const parentOrder = returnDoc?.parentOrderId
    ? await QuickOrder.findById(returnDoc.parentOrderId).lean()
    : await QuickOrder.findOne({
        orderId: returnDoc.orderId,
        orderType: { $in: ['quick', 'mixed'] },
      }).lean();

  const seller = await Seller.findById(returnDoc.sellerId).lean();
  const customerCoords = resolveCoords(parentOrder?.deliveryAddress?.location);
  const sellerCoords = resolveCoords(seller?.location);

  const feeSettings = await getActiveFeeSettings();
  const riderEarning = Math.max(
    0,
    num(returnDoc?.returnDeliveryCommission) ||
      num(feeSettings?.returnPickupFee) ||
      num(feeSettings?.returnDeliveryCommission),
  );

  return { parentOrder, seller, customerCoords, sellerCoords, riderEarning };
};

export const buildReturnDeliverySocketPayload = async (returnDoc, context = null) => {
  const ctx = context || (await loadReturnPickupContext(returnDoc));
  const { parentOrder, seller, customerCoords, sellerCoords, riderEarning } = ctx;

  const customerAddress = parentOrder?.deliveryAddress || {};
  const customerAddressText = [
    customerAddress.formattedAddress,
    customerAddress.street || customerAddress.address,
    customerAddress.city,
    customerAddress.state,
    customerAddress.zipCode,
  ]
    .filter(Boolean)
    .join(', ');

  const sellerAddressText = [
    seller?.location?.formattedAddress,
    seller?.location?.address,
    seller?.shopInfo?.formattedAddress,
  ]
    .filter(Boolean)
    .join(', ');

  const returnId = String(returnDoc._id);
  const pickupPoint = {
    legId: `return-pickup:${returnId}`,
    pickupType: 'quick',
    sourceId: String(returnDoc.userId || ''),
    sourceName: returnDoc?.customer?.name || 'Customer',
    address: customerAddressText,
    phone: returnDoc?.customer?.phone || '',
    location: customerCoords
      ? {
          coordinates: [customerCoords.lng, customerCoords.lat],
          lat: customerCoords.lat,
          lng: customerCoords.lng,
          address: customerAddressText,
        }
      : undefined,
  };

  const dropPoint = {
    legId: `return-drop:${returnId}`,
    pickupType: 'quick',
    sourceId: String(returnDoc.sellerId || ''),
    sourceName: seller?.shopName || seller?.name || 'Seller',
    address: sellerAddressText,
    phone: seller?.phone || '',
    location: sellerCoords
      ? {
          coordinates: [sellerCoords.lng, sellerCoords.lat],
          lat: sellerCoords.lat,
          lng: sellerCoords.lng,
          address: sellerAddressText,
        }
      : undefined,
  };

  return {
    documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
    tripType: RETURN_TRIP_TYPE,
    tripLabel: 'Return Pickup',
    displayTitle: 'Return Pickup',
    returnId,
    orderMongoId: returnId,
    orderId: returnDoc.orderId,
    parentOrderId: returnDoc.orderId,
    sellerId: String(returnDoc.sellerId || ''),
    customerId: returnDoc.userId ? String(returnDoc.userId) : '',
    orderType: 'quick',
    orderStatus: returnDoc.returnStatus,
    status: returnDoc.returnStatus,
    returnStatus: returnDoc.returnStatus,
    items: returnDoc.returnItems || [],
    pricing: { subtotal: num(returnDoc.returnRefundAmount), total: num(returnDoc.returnRefundAmount) },
    total: num(returnDoc.returnRefundAmount),
    paymentMethod: 'prepaid',
    restaurantName: seller?.shopName || seller?.name || 'Seller store',
    restaurantAddress: sellerAddressText,
    restaurantPhone: seller?.phone || '',
    restaurantLocation: sellerCoords
      ? {
          latitude: sellerCoords.lat,
          longitude: sellerCoords.lng,
          address: sellerAddressText,
          coordinates: [sellerCoords.lng, sellerCoords.lat],
        }
      : {},
    deliveryAddress: customerAddress,
    customerAddress: customerAddressText,
    customerLocation: customerCoords,
    customerName: returnDoc?.customer?.name || 'Customer',
    customerPhone: returnDoc?.customer?.phone || '',
    userName: returnDoc?.customer?.name || 'Customer',
    userPhone: returnDoc?.customer?.phone || '',
    pickupPoints: [pickupPoint],
    dropPoint,
    dispatchLeg: pickupPoint,
    dispatch: returnDoc.dispatch || {},
    riderEarning,
    earnings: riderEarning,
    deliveryFee: 0,
    note: returnDoc.returnReason || '',
    createdAt: returnDoc.createdAt,
    updatedAt: returnDoc.updatedAt,
  };
};

export const normalizePickupImageEntries = (images = [], { actorId, actorRole = 'DELIVERY_PARTNER' } = {}) => {
  const list = Array.isArray(images) ? images : images ? [images] : [];
  const normalized = list
    .map((entry) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        if (!url) return null;
        return {
          url,
          uploadedAt: new Date(),
          uploadedBy: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : undefined,
          uploadedByRole: actorRole,
          metadata: {},
        };
      }
      if (entry && typeof entry === 'object') {
        const url = String(entry.url || entry.imageUrl || '').trim();
        if (!url) return null;
        return {
          url,
          uploadedAt: entry.uploadedAt ? new Date(entry.uploadedAt) : new Date(),
          uploadedBy:
            entry.uploadedBy && mongoose.Types.ObjectId.isValid(entry.uploadedBy)
              ? entry.uploadedBy
              : actorId && mongoose.Types.ObjectId.isValid(actorId)
                ? actorId
                : undefined,
          uploadedByRole: entry.uploadedByRole || actorRole,
          metadata: entry.metadata || {},
        };
      }
      return null;
    })
    .filter(Boolean);

  if (!normalized.length) {
    throw new ValidationError('At least one pickup image is required');
  }

  return normalized.slice(0, 8);
};

export const serializeReturnForDelivery = async (returnDoc, context = null) => {
  const ctx = context || (await loadReturnPickupContext(returnDoc));
  return buildReturnDeliverySocketPayload(returnDoc, ctx);
};
