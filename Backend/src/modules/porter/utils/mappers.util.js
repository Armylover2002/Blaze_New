import { normalizeBannerType, normalizeBannerTarget } from '../validators/banner.validator.js';

const toId = (doc) => (doc?._id ? String(doc._id) : doc?.id ? String(doc.id) : '');

const generateFallbackZoneCode = (name = '', id = '') => {
    let prefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    if (prefix.length < 3) prefix = prefix.padEnd(3, 'X');
    const suffix = id.substring(id.length - 3).toUpperCase();
    return `${prefix}${suffix}`;
};

export const mapZone = (doc = {}) => ({
    id: toId(doc),
    zoneCode: doc.zoneCode || generateFallbackZoneCode(doc.name, toId(doc)),
    name: doc.name || '',
    country: doc.country || 'India',
    unit: doc.unit || 'kilometer',
    status: doc.status || 'inactive',
    coordinates: Array.isArray(doc.geometry?.coordinates?.[0])
        ? doc.geometry.coordinates[0].map(([lng, lat]) => ({
            lat: Number(lat),
            lng: Number(lng),
        }))
        : [],
    displayOrder: Number(doc.displayOrder || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});


export const mapVehicle = (doc = {}) => {
    return {
        id: toId(doc),
        vehicleCode: doc.vehicleCode || '',
        category: doc.category || '',
        description: doc.description || '',
        iconUrl: doc.iconUrl || '',
        minWeight: Number(doc.minWeight || 0),
        maxWeight: Number(doc.maxWeight || 0),
        supportedServices: Array.isArray(doc.supportedServices) ? doc.supportedServices : [],
        status: doc.status || 'inactive',
        displayOrder: Number(doc.displayOrder || 0),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
};

export const mapPublicVehicle = (doc = {}) => {
    const category = doc.category || '';
    return {
        id: toId(doc),
        name: category,
        category,
        iconUrl: doc.iconUrl || '',
        maxWeight: Number(doc.maxWeight || 0),
        description: doc.description || '',
        supportedServices: Array.isArray(doc.supportedServices) ? doc.supportedServices : [],
    };
};

export const mapPricing = (doc = {}, vehicle = null) => ({
    id: toId(doc),
    vehicleId: toId(doc.vehicleId || vehicle),
    enableDistanceCharges: doc.enableDistanceCharges !== false,
    basePrice: Number(doc.basePrice || 0),
    baseDistance: Number(doc.baseDistance || 0),
    distancePrice: Number(doc.distancePrice || 0),
    serviceTax: Number(doc.serviceTax || 0),
    commissionType: doc.commissionType || 'Percentage',
    commissionValue: Number(doc.commissionValue || 0),
    status: doc.status || 'active',
    description: doc.description || '',
    pricingConfigured: true,
    vehicle: vehicle ? {
        id: toId(vehicle),
        category: vehicle.category || '',
        iconUrl: vehicle.iconUrl || '',
    } : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

export const mapVehiclePricingRow = (vehicleDoc = {}, pricingDoc = null) => {
    const vehicle = {
        id: toId(vehicleDoc),
        category: vehicleDoc.category || '',
        iconUrl: vehicleDoc.iconUrl || '',
    };

    if (!pricingDoc) {
        return {
            id: null,
            vehicleId: vehicle.id,
            enableDistanceCharges: true,
            basePrice: null,
            baseDistance: null,
            distancePrice: null,
            serviceTax: null,
            commissionType: null,
            commissionValue: null,
            status: null,
            description: '',
            pricingConfigured: false,
            vehicle,
            category: vehicle.category,
            iconUrl: vehicle.iconUrl,
        };
    }

    return {
        id: toId(pricingDoc),
        vehicleId: toId(pricingDoc.vehicleId),
        enableDistanceCharges: pricingDoc.enableDistanceCharges !== false,
        basePrice: Number(pricingDoc.basePrice || 0),
        baseDistance: Number(pricingDoc.baseDistance || 0),
        distancePrice: Number(pricingDoc.distancePrice || 0),
        serviceTax: Number(pricingDoc.serviceTax || 0),
        commissionType: pricingDoc.commissionType || 'Percentage',
        commissionValue: Number(pricingDoc.commissionValue || 0),
        status: pricingDoc.status || 'active',
        description: pricingDoc.description || '',
        pricingConfigured: true,
        vehicle,
        category: vehicle.category,
        iconUrl: vehicle.iconUrl,
        createdAt: pricingDoc.createdAt,
        updatedAt: pricingDoc.updatedAt,
    };
};

export const buildRelationMaps = (zones = [], vehicles = []) => {
    const zoneMap = {};
    const vehicleMap = {};

    zones.forEach((zone) => {
        zoneMap[toId(zone)] = { id: toId(zone), name: zone.name || '' };
    });

    vehicles.forEach((vehicle) => {
        vehicleMap[toId(vehicle)] = {
            id: toId(vehicle),
            category: vehicle.category || '',
        };
    });

    return { zoneMap, vehicleMap };
};

const mapCouponZoneRefs = (zoneIds = [], zoneMap = {}, legacyZones = []) => {
    if (zoneIds?.length) {
        return zoneIds.map((zoneId) => {
            const key = toId(zoneId);
            return zoneMap[key] || { id: key, name: '' };
        });
    }

    if (Array.isArray(legacyZones) && legacyZones.length && !legacyZones.includes('All Zones')) {
        return legacyZones.map((name) => ({ id: '', name: String(name) }));
    }

    return [];
};

const mapCouponVehicleRefs = (vehicleIds = [], vehicleMap = {}, legacyVehicleTypes = []) => {
    if (vehicleIds?.length) {
        return vehicleIds.map((vehicleId) => {
            const key = toId(vehicleId);
            return vehicleMap[key] || { id: key, name: '', category: '' };
        });
    }

    if (Array.isArray(legacyVehicleTypes) && legacyVehicleTypes.length && !legacyVehicleTypes.includes('All')) {
        return legacyVehicleTypes.map((name) => ({ id: '', name: String(name), category: '' }));
    }

    return [];
};

export const mapCoupon = (doc = {}, zoneMap = {}, vehicleMap = {}) => ({
    id: toId(doc),
    code: doc.code || '',
    name: doc.name || '',
    description: doc.description || '',
    discountType: doc.discountType || 'percentage',
    discountValue: Number(doc.discountValue || 0),
    maxDiscount: Number(doc.maxDiscount || 0),
    minOrderValue: Number(doc.minOrderValue || 0),
    maxUses: Number(doc.maxUses || 0),
    usedCount: Number(doc.usedCount || 0),
    perUserLimit: Number(doc.perUserLimit || 1),
    validFrom: doc.validFrom,
    validUntil: doc.validUntil,
    firstOrderOnly: Boolean(doc.firstOrderOnly),
    newCustomerOnly: Boolean(doc.newCustomerOnly),
    autoApply: Boolean(doc.autoApply),
    zones: mapCouponZoneRefs(doc.zoneIds, zoneMap, doc.zones),
    vehicles: mapCouponVehicleRefs(doc.vehicleIds, vehicleMap, doc.vehicleTypes),
    status: doc.status || 'inactive',
    campaignRevenue: Number(doc.campaignRevenue || 0),
    totalDiscountGiven: Number(doc.totalDiscountGiven || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

export const mapBanner = (doc = {}) => {
    const now = Date.now();
    const startDate = doc.startDate ? new Date(doc.startDate) : null;
    const endDate = doc.endDate ? new Date(doc.endDate) : null;
    let status = doc.status || 'inactive';

    if (endDate && endDate.getTime() < now) {
        status = 'expired';
    } else if (startDate && startDate.getTime() > now && status !== 'inactive') {
        status = 'scheduled';
    } else if (status === 'scheduled' && startDate && endDate && startDate.getTime() <= now && endDate.getTime() >= now) {
        status = 'active';
    }

    const type = normalizeBannerType(doc.type || doc.redirectType);
    const target = normalizeBannerTarget(doc.target || doc.redirectValue);

    return {
        id: toId(doc),
        title: doc.title || '',
        type,
        target,
        priority: Number(doc.priority || 1),
        image: doc.image?.url || (typeof doc.image === 'string' ? doc.image : ''),
        startDate: doc.startDate,
        endDate: doc.endDate,
        status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
};

export const mapPublicBanner = (doc = {}) => {
    const mapped = mapBanner(doc);
    return {
        id: mapped.id,
        title: mapped.title,
        subtitle: doc.subtitle || '',
        image: mapped.image,
        redirectType: doc.redirectType || mapped.type || 'promotional',
        redirectValue: doc.redirectValue || mapped.target || '',
    };
};

export const mapPublicCoupon = (doc = {}) => {
    let applicableVehicles = [];
    if (doc.vehicleIds && doc.vehicleIds.length > 0) {
        applicableVehicles = doc.vehicleIds.map(v => (v.category || v)).filter(Boolean);
    }

    return {
        id: toId(doc),
        code: doc.code || '',
        name: doc.name || '',
        description: doc.description || '',
        discountType: String(doc.discountType).toLowerCase() === 'flat' ? 'Flat' : 'Percentage',
        discountValue: Number(doc.discountValue || 0),
        maxDiscount: Number(doc.maxDiscount || 0),
        minOrderValue: Number(doc.minOrderValue || 0),
        perUserLimit: Number(doc.perUserLimit || 1),
        validFrom: doc.validFrom,
        validUntil: doc.validUntil,
        firstOrderOnly: Boolean(doc.firstOrderOnly),
        newCustomerOnly: Boolean(doc.newCustomerOnly),
        autoApply: Boolean(doc.autoApply),
        status: doc.status || 'inactive',
        applicableVehicles,
    };
};

export const mapPorterUser = (doc = {}, extras = {}) => ({
    id: toId(doc),
    name: doc.name || '',
    avatar: doc.profileImage || extras.avatar || '',
    email: doc.email || '',
    phone: doc.phone ? (doc.countryCode ? `${doc.countryCode} ${doc.phone}` : doc.phone) : '',
    zone: extras.zone || '',
    address: extras.address || (() => {
        const main = [doc.address?.street, doc.address?.city, doc.address?.state, doc.address?.zipCode].filter(Boolean).join(', ');
        if (main) return main;
        if (doc.addresses && doc.addresses.length > 0) {
            const addr = doc.addresses[0];
            return [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ');
        }
        return '';
    })(),
    totalOrders: Number(extras.totalOrders || 0),
    completedOrders: Number(extras.completedOrders || 0),
    cancelledOrders: Number(extras.cancelledOrders || 0),
    walletBalance: Number(doc.walletBalance || 0),
    verification: doc.isVerified ? 'verified' : 'pending',
    status: doc.isActive === false ? 'inactive' : 'active',
    registeredAt: doc.createdAt,
    recentOrders: Array.isArray(extras.recentOrders) ? extras.recentOrders : [],
});
