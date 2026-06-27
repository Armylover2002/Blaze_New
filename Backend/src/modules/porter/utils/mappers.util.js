const toId = (doc) => (doc?._id ? String(doc._id) : doc?.id ? String(doc.id) : '');

export const mapZone = (doc = {}, stats = {}) => ({
    id: toId(doc),
    name: doc.name || '',
    city: doc.city || '',
    pincode: doc.pincode || '',
    status: doc.status || 'inactive',
    coverageKm: Number(doc.coverageKm || 0),
    description: doc.description || '',
    polygon: doc.polygon || (Array.isArray(doc.coordinates) && doc.coordinates.length
        ? `${doc.coordinates.length}-point polygon`
        : 'No area selected'),
    coordinates: Array.isArray(doc.coordinates)
        ? doc.coordinates.map((c) => ({
            lat: Number(c.lat ?? c.latitude),
            lng: Number(c.lng ?? c.longitude),
        }))
        : [],
    displayOrder: Number(doc.displayOrder || 0),
    orders: Number(stats.orders || 0),
    drivers: Number(stats.drivers || 0),
    vehicles: Number(stats.vehicles || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

export const mapVehicle = (doc = {}, pricing = null) => {
    const base = {
        id: toId(doc),
        vehicleCode: doc.vehicleCode || '',
        name: doc.name || '',
        category: doc.category || '',
        icon: doc.icon || 'Truck',
        iconUrl: doc.iconUrl || '',
        image: doc.iconUrl || doc.image || '',
        description: doc.description || '',
        minWeight: Number(doc.minWeight || 0),
        maxWeight: Number(doc.maxWeight || 0),
        status: doc.status || 'inactive',
        supportedServices: Array.isArray(doc.supportedServices) ? doc.supportedServices : [],
        assignedDrivers: Number(doc.assignedDrivers || 0),
        count: Number(doc.count || 0),
        displayOrder: Number(doc.displayOrder || 0),
        pricingConfigured: false,
        enableDistanceCharges: true,
        basePrice: 0,
        baseDistance: 2,
        distancePrice: 10,
        serviceTax: 5,
        commissionType: 'Percentage',
        commissionValue: 10,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };

    if (!pricing) return base;

    const configured = pricing.pricingConfigured !== false
        && pricing.basePrice != null
        && Number(pricing.basePrice) >= 0;

    return {
        ...base,
        pricingConfigured: configured,
        enableDistanceCharges: pricing.enableDistanceCharges !== false,
        basePrice: Number(pricing.basePrice || 0),
        baseDistance: Number(pricing.baseDistance || 0),
        distancePrice: Number(pricing.distancePrice || 0),
        serviceTax: Number(pricing.serviceTax || 0),
        commissionType: pricing.commissionType || 'Percentage',
        commissionValue: Number(pricing.commissionValue || 0),
        description: pricing.description || base.description,
        status: pricing.status || base.status,
        pricingId: toId(pricing),
        vehicleId: toId(doc),
    };
};

export const mapPricing = (doc = {}, vehicle = null) => ({
    id: toId(doc),
    vehicleId: toId(doc.vehicleId || vehicle),
    zoneId: doc.zoneId ? String(doc.zoneId) : null,
    enableDistanceCharges: doc.enableDistanceCharges !== false,
    basePrice: Number(doc.basePrice || 0),
    baseDistance: Number(doc.baseDistance || 0),
    distancePrice: Number(doc.distancePrice || 0),
    serviceTax: Number(doc.serviceTax || 0),
    commissionType: doc.commissionType || 'Percentage',
    commissionValue: Number(doc.commissionValue || 0),
    status: doc.status || 'active',
    description: doc.description || '',
    pricingConfigured: doc.pricingConfigured !== false,
    vehicle: vehicle ? { id: toId(vehicle), name: vehicle.name, category: vehicle.category } : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

export const mapCoupon = (doc = {}) => ({
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
    active: doc.active !== false,
    autoApply: Boolean(doc.autoApply),
    zones: Array.isArray(doc.zones) ? doc.zones : ['All Zones'],
    vehicleTypes: Array.isArray(doc.vehicleTypes) ? doc.vehicleTypes : ['All'],
    customerSegment: doc.customerSegment || 'All Customers',
    status: doc.status || 'inactive',
    image: doc.image?.url || doc.image || null,
    banner: doc.banner?.url || doc.banner || null,
    campaignRevenue: Number(doc.campaignRevenue || 0),
    totalDiscountGiven: Number(doc.totalDiscountGiven || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

export const mapBanner = (doc = {}) => ({
    id: toId(doc),
    title: doc.title || '',
    subtitle: doc.subtitle || '',
    type: doc.redirectType || doc.type || 'promotional',
    target: doc.redirectValue || doc.target || 'Home',
    redirectType: doc.redirectType || doc.type || 'promotional',
    redirectValue: doc.redirectValue || doc.target || 'Home',
    priority: Number(doc.priority || 0),
    displayOrder: Number(doc.displayOrder ?? doc.priority ?? 0),
    image: doc.image?.url || doc.image || '',
    imagePublicId: doc.image?.publicId || null,
    link: doc.link || doc.linkUrl || '',
    linkUrl: doc.link || doc.linkUrl || '',
    startDate: doc.startDate,
    endDate: doc.endDate,
    status: doc.status || 'inactive',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

export const mapPorterUser = (doc = {}, extras = {}) => ({
    id: toId(doc),
    name: doc.name || '',
    avatar: doc.profileImage || extras.avatar || '',
    email: doc.email || '',
    phone: doc.phone ? (doc.countryCode ? `${doc.countryCode} ${doc.phone}` : doc.phone) : '',
    zone: extras.zone || '',
    address: extras.address || [
        doc.address?.street,
        doc.address?.city,
        doc.address?.state,
        doc.address?.zipCode,
    ].filter(Boolean).join(', '),
    totalOrders: Number(extras.totalOrders || 0),
    completedOrders: Number(extras.completedOrders || 0),
    cancelledOrders: Number(extras.cancelledOrders || 0),
    walletBalance: Number(doc.walletBalance || 0),
    verification: doc.isVerified ? 'verified' : 'pending',
    status: doc.isActive === false ? 'inactive' : 'active',
    registeredAt: doc.createdAt,
    recentOrders: Array.isArray(extras.recentOrders) ? extras.recentOrders : [],
});
