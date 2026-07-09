import mongoose from 'mongoose';
import { PorterPricing } from '../../models/porterPricing.model.js';
import { PorterVehicle } from '../../models/porterVehicle.model.js';
import { PorterCoupon } from '../../models/porterCoupon.model.js';
import { PorterOrder } from '../models/porterOrder.model.js';
import { NotFoundError, ValidationError } from '../../../../core/auth/errors.js';
import { validateCouponForRedemption } from '../../services/coupon.service.js';
import { getRoutePreview } from '../../services/maps.service.js';
import { assertPorterLocationsServiceable } from './porter-zone-lookup.service.js';
import { calculateFareFromPricing } from '../../utils/porter-pricing-calculator.util.js';
import {
    assertVehicleEligibleForParcelWeight,
    computeParcelWeight,
} from '../../services/porter-parcel-vehicle.service.js';

const baseFilter = { isDeleted: { $ne: true } };

function computeCouponDiscount(coupon, orderTotal) {
    if (!coupon) return 0;
    const total = Number(orderTotal) || 0;
    const minOrder = Number(coupon.minOrderValue || 0);
    if (total < minOrder) {
        throw new ValidationError(`Minimum order value ₹${minOrder} required for this coupon`);
    }

    let discount = 0;
    if (coupon.discountType === 'flat') {
        discount = Number(coupon.discountValue || 0);
    } else {
        discount = (total * Number(coupon.discountValue || 0)) / 100;
        const maxDiscount = Number(coupon.maxDiscount || 0);
        if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
    }
    return Math.min(Math.round(discount), total);
}

async function resolveVehiclePricing(vehicleId) {
    const oid = new mongoose.Types.ObjectId(vehicleId);
    const vehicle = await PorterVehicle.findOne({
        _id: oid,
        ...baseFilter,
        status: 'active',
        supportedServices: { $in: ['parcel'] },
    }).select({ name: 1, vehicleCode: 1 }).lean();

    if (!vehicle) throw new NotFoundError('Vehicle not found or not available for parcel');

    const pricing = await PorterPricing.findOne({
        vehicleId: oid,
        ...baseFilter,
        status: 'active',
    }).lean();

    if (!pricing) throw new ValidationError('Pricing not configured for this vehicle');

    return { vehicle, pricing };
}

async function validateCouponScope(coupon, { zoneId, vehicleId, userId }) {
    validateCouponForRedemption(coupon);

    if (coupon.zoneIds?.length && zoneId) {
        const zoneStr = String(zoneId);
        const allowed = coupon.zoneIds.some((z) => String(z) === zoneStr);
        if (!allowed) throw new ValidationError('Coupon not valid in this zone');
    }

    if (coupon.vehicleIds?.length && vehicleId) {
        const vehStr = String(vehicleId);
        const allowed = coupon.vehicleIds.some((v) => String(v) === vehStr);
        if (!allowed) throw new ValidationError('Coupon not valid for this vehicle');
    }

    if (coupon.firstOrderOnly || coupon.newCustomerOnly) {
        const priorCount = await PorterOrder.countDocuments({
            userId: new mongoose.Types.ObjectId(userId),
            isDeleted: { $ne: true },
            status: { $nin: ['failed', 'cancelled_by_user', 'cancelled_by_admin', 'cancelled_by_driver'] },
        });
        if (priorCount > 0) {
            throw new ValidationError('Coupon is only valid for first order');
        }
    }

    if (coupon.usedCount >= coupon.maxUses) {
        throw new ValidationError('Coupon usage limit reached');
    }

    if (coupon.perUserLimit > 0 && userId) {
        const userUses = await PorterOrder.countDocuments({
            userId: new mongoose.Types.ObjectId(userId),
            couponId: coupon._id,
            isDeleted: { $ne: true },
        });
        if (userUses >= coupon.perUserLimit) {
            throw new ValidationError('Coupon per-user limit reached');
        }
    }
}

export async function calculatePorterOrderPricing({
    pickup,
    delivery,
    vehicleId,
    couponCode,
    userId,
    parcel,
}) {
    const route = await getRoutePreview({ pickup, delivery });
    const parcelWeight = computeParcelWeight(parcel);
    await assertVehicleEligibleForParcelWeight(vehicleId, parcelWeight);
    const { vehicle, pricing } = await resolveVehiclePricing(vehicleId);
    const serviceability = await assertPorterLocationsServiceable(pickup, delivery);
    const zone = serviceability.pickupZone;

    const fareParts = calculateFareFromPricing(pricing, route.distanceKm);
    let coupon = null;
    let discount = 0;

    if (couponCode) {
        coupon = await PorterCoupon.findOne({
            code: String(couponCode).trim().toUpperCase(),
            ...baseFilter,
        }).lean();
        if (!coupon) throw new NotFoundError('Coupon not found');
        await validateCouponScope(coupon, { zoneId: zone?._id, vehicleId, userId });
        discount = computeCouponDiscount(coupon, fareParts.total);
    }

    const total = Math.max(0, fareParts.total - discount);

    return {
        route,
        vehicle: { id: String(vehicle._id), name: vehicle.name, vehicleCode: vehicle.vehicleCode },
        zoneId: zone?._id ? String(zone._id) : null,
        dropZoneId: serviceability.dropZone?._id ? String(serviceability.dropZone._id) : null,
        sameZone: serviceability.sameZone,
        pricing: {
            ...fareParts,
            discount,
            total,
        },
        coupon: coupon ? { id: String(coupon._id), code: coupon.code } : null,
    };
}
