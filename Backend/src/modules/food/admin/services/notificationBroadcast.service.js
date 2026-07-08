import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { Seller } from '../../../quick-commerce/seller/models/seller.model.js';
import { SellerNotification } from '../../../quick-commerce/seller/models/sellerNotification.model.js';
import { BroadcastNotification } from '../../../../core/notifications/models/notificationBroadcast.model.js';
import { FoodNotification } from '../../../../core/notifications/models/notification.model.js';
import { createInboxNotifications } from '../../../../core/notifications/notification.service.js';
import { notifyOwnersSafely } from '../../../../core/notifications/firebase.service.js';
import { filterTargetsByChannel } from './notificationChannel.service.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import { getIO, rooms } from '../../../../config/socket.js';

const TARGET_TYPE_MAP = {
    ALL: 'ALL',
    ALL_QC: 'ALL_QC',
    USER: 'USER',
    RESTAURANT: 'RESTAURANT',
    SELLER: 'SELLER',
    DELIVERY: 'DELIVERY',
    CUSTOM: 'CUSTOM'
};

const OWNER_LABEL_MAP = {
    ALL: 'All (Food)',
    ALL_QC: 'All (Quick Commerce)',
    USER: 'Users',
    RESTAURANT: 'Restaurants',
    SELLER: 'Sellers',
    DELIVERY: 'Delivery Partners',
    DELIVERY_PARTNER: 'Delivery Partners'
};

const toObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
        throw new ValidationError(`${fieldName} is invalid`);
    }
    return new mongoose.Types.ObjectId(String(value));
};

const normalizeText = (value, fieldName, required = true) => {
    const text = String(value || '').trim();
    if (required && !text) {
        throw new ValidationError(`${fieldName} is required`);
    }
    return text;
};

const normalizeTargetType = (value) => {
    const nextValue = String(value || '').trim().toUpperCase();
    const normalized = TARGET_TYPE_MAP[nextValue];
    if (!normalized) {
        throw new ValidationError('targetType is invalid');
    }
    return normalized;
};

const ownerModelMap = {
    USER: FoodUser,
    RESTAURANT: FoodRestaurant,
    SELLER: Seller,
    DELIVERY_PARTNER: FoodDeliveryPartner
};

const buildUserLabel = (doc) => ({
    label: String(doc?.name || doc?.phone || 'User').trim(),
    subLabel: [doc?.phone, doc?.email].filter(Boolean).join(' • ')
});

const buildRestaurantLabel = (doc) => ({
    label: String(doc?.restaurantName || doc?.ownerName || 'Restaurant').trim(),
    subLabel: [doc?.ownerPhone, doc?.ownerEmail].filter(Boolean).join(' • ')
});

const buildSellerLabel = (doc) => ({
    label: String(doc?.shopName || doc?.name || 'Seller').trim(),
    subLabel: [doc?.phone, doc?.email].filter(Boolean).join(' • ')
});

const buildDeliveryLabel = (doc) => ({
    label: String(doc?.name || doc?.phone || 'Delivery Partner').trim(),
    subLabel: [doc?.phone, doc?.email].filter(Boolean).join(' • ')
});

const modelConfigMap = {
    USER: {
        model: FoodUser,
        query: { isActive: true },
        select: '_id name phone email',
        buildLabel: buildUserLabel
    },
    RESTAURANT: {
        model: FoodRestaurant,
        query: { status: 'approved' },
        select: '_id restaurantName ownerName ownerPhone ownerEmail',
        buildLabel: buildRestaurantLabel
    },
    SELLER: {
        model: Seller,
        query: { approvalStatus: 'approved' },
        select: '_id name shopName phone email',
        buildLabel: buildSellerLabel
    },
    DELIVERY_PARTNER: {
        model: FoodDeliveryPartner,
        query: { status: 'approved' },
        select: '_id name phone email',
        buildLabel: buildDeliveryLabel
    }
};

const dedupeTargets = (targets = []) => {
    const map = new Map();
    for (const target of Array.isArray(targets) ? targets : []) {
        const ownerType = String(target?.ownerType || '').trim().toUpperCase();
        const ownerId = String(target?.ownerId || '').trim();
        if (!ownerType || !ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) continue;
        map.set(`${ownerType}:${ownerId}`, {
            ownerType,
            ownerId,
            label: String(target?.label || '').trim(),
            subLabel: String(target?.subLabel || '').trim()
        });
    }
    return [...map.values()];
};

const loadTargetsByOwnerType = async (ownerType) => {
    const config = modelConfigMap[ownerType];
    if (!config) return [];

    const rows = await config.model.find(config.query).select(config.select).lean();
    return rows.map((row) => ({
        ownerType,
        ownerId: String(row._id),
        ...config.buildLabel(row)
    }));
};

const resolveCustomTargets = async ({ targets = [], targetIds = [] } = {}) => {
    const explicitTargets = dedupeTargets(targets);
    if (explicitTargets.length > 0) return explicitTargets;

    const ids = [...new Set((Array.isArray(targetIds) ? targetIds : []).map((value) => String(value || '').trim()).filter(Boolean))];
    if (!ids.length) {
        throw new ValidationError('Please select at least one recipient for custom broadcast');
    }

    const users = await FoodUser.find({ _id: { $in: ids }, isActive: true }).select('_id name phone email').lean();
    return users.map((row) => ({
        ownerType: 'USER',
        ownerId: String(row._id),
        ...buildUserLabel(row)
    }));
};

const resolveTargets = async ({ targetType, targetIds = [], targets = [] } = {}) => {
    if (targetType === 'ALL') {
        const [users, restaurants, deliveryPartners] = await Promise.all([
            loadTargetsByOwnerType('USER'),
            loadTargetsByOwnerType('RESTAURANT'),
            loadTargetsByOwnerType('DELIVERY_PARTNER')
        ]);
        return [...users, ...restaurants, ...deliveryPartners];
    }

    if (targetType === 'ALL_QC') {
        const [users, sellers, deliveryPartners] = await Promise.all([
            loadTargetsByOwnerType('USER'),
            loadTargetsByOwnerType('SELLER'),
            loadTargetsByOwnerType('DELIVERY_PARTNER')
        ]);
        return [...users, ...sellers, ...deliveryPartners];
    }

    if (targetType === 'USER') return loadTargetsByOwnerType('USER');
    if (targetType === 'RESTAURANT') return loadTargetsByOwnerType('RESTAURANT');
    if (targetType === 'SELLER') return loadTargetsByOwnerType('SELLER');
    if (targetType === 'DELIVERY') return loadTargetsByOwnerType('DELIVERY_PARTNER');
    if (targetType === 'CUSTOM') return resolveCustomTargets({ targets, targetIds });

    throw new ValidationError('Unsupported targetType');
};

const buildNotificationPayload = ({ title, message, link, broadcastId, target }) => ({
    ownerType: target.ownerType,
    ownerId: target.ownerId,
    title,
    message,
    link,
    category: 'broadcast',
    broadcastId,
    metadata: {
        broadcastId: String(broadcastId),
        ownerLabel: target.label || '',
        ownerSubLabel: target.subLabel || ''
    }
});

const upsertSellerInboxNotifications = async ({ targets = [], broadcast, title, message, link }) => {
    const sellerTargets = (Array.isArray(targets) ? targets : []).filter((target) => target?.ownerType === 'SELLER');
    if (!sellerTargets.length) return;

    const broadcastId = String(broadcast?._id || '');
    if (!broadcastId) return;

    const operations = sellerTargets
        .map((target) => String(target?.ownerId || '').trim())
        .filter((sellerId) => mongoose.Types.ObjectId.isValid(sellerId))
        .map((sellerId) => ({
            updateOne: {
                filter: {
                    sellerId: new mongoose.Types.ObjectId(sellerId),
                    key: `broadcast:${broadcastId}`
                },
                update: {
                    $set: {
                        type: 'system',
                        title,
                        message,
                        metadata: {
                            source: 'admin_broadcast',
                            broadcastId,
                            link: String(link || '').trim()
                        }
                    },
                    $setOnInsert: { isRead: false }
                },
                upsert: true
            }
        }));

    if (!operations.length) return;
    await SellerNotification.bulkWrite(operations, { ordered: false });
};

const emitRealtimeNotifications = (targets = [], broadcast) => {
    const io = getIO();
    if (!io) return;

    for (const target of targets) {
        const ownerId = String(target.ownerId || '');
        if (!ownerId) continue;

        const payload = {
            id: String(broadcast._id),
            title: broadcast.title,
            message: broadcast.message,
            link: broadcast.link || '',
            targetType: broadcast.targetType,
            createdAt: broadcast.createdAt
        };

        if (target.ownerType === 'USER') {
            io.to(rooms.user(ownerId)).emit('admin_notification', payload);
        }
        if (target.ownerType === 'RESTAURANT') {
            io.to(rooms.restaurant(ownerId)).emit('admin_notification', payload);
        }
        if (target.ownerType === 'SELLER') {
            io.to(rooms.seller(ownerId)).emit('admin_notification', payload);
        }
        if (target.ownerType === 'DELIVERY_PARTNER') {
            io.to(rooms.delivery(ownerId)).emit('admin_notification', payload);
        }
    }
};

const paginationMeta = ({ page = 1, limit = 10 } = {}) => {
    const nextPage = Math.max(1, Number(page) || 1);
    const nextLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    return {
        page: nextPage,
        limit: nextLimit,
        skip: (nextPage - 1) * nextLimit
    };
};

export const createBroadcastNotification = async ({ body = {}, adminId } = {}) => {
    const title = normalizeText(body?.title, 'title');
    const message = normalizeText(body?.message, 'message');
    const link = normalizeText(body?.link, 'link', false);
    const targetType = normalizeTargetType(body?.targetType);
    const resolvedTargets = await resolveTargets({
        targetType,
        targetIds: body?.targetIds,
        targets: body?.targets
    });

    if (!resolvedTargets.length) {
        throw new ValidationError(`No recipients found for ${targetType.toLowerCase()} broadcast`);
    }

    const targetIds = resolvedTargets.map((target) => toObjectId(target.ownerId, 'targetId'));

    const broadcast = await BroadcastNotification.create({
        title,
        message,
        targetType,
        targetIds: targetType === 'CUSTOM' ? targetIds : [],
        targets: resolvedTargets.map((target) => ({
            ownerType: target.ownerType,
            ownerId: toObjectId(target.ownerId, 'ownerId'),
            label: target.label || '',
            subLabel: target.subLabel || ''
        })),
        link,
        createdBy: toObjectId(adminId, 'createdBy'),
        targetCount: resolvedTargets.length
    });

    // Respect Notification Channels setup (Push / In-App). Mail/SMS for broadcasts
    // are persisted as preferences but not dispatched here until providers are wired.
    const [inAppTargets, pushTargets] = await Promise.all([
        filterTargetsByChannel({
            targets: resolvedTargets,
            topicKey: 'admin_broadcast',
            channel: 'inApp'
        }),
        filterTargetsByChannel({
            targets: resolvedTargets,
            topicKey: 'admin_broadcast',
            channel: 'push'
        })
    ]);

    // FoodNotification inbox only supports USER / RESTAURANT / DELIVERY_PARTNER.
    // Seller targets are persisted on the broadcast record and delivered via push/realtime;
    // SellerNotification inbox wiring is handled separately.
    const foodInboxTargets = inAppTargets.filter((target) => target.ownerType !== 'SELLER');
    if (foodInboxTargets.length > 0) {
        await createInboxNotifications({
            notifications: foodInboxTargets.map((target) =>
                buildNotificationPayload({
                    title,
                    message,
                    link,
                    broadcastId: broadcast._id,
                    target
                })
            )
        });
    }
    await upsertSellerInboxNotifications({
        targets: inAppTargets,
        broadcast,
        title,
        message,
        link
    });

    if (pushTargets.length > 0) {
        await notifyOwnersSafely(
            pushTargets.map((target) => ({
                ownerType: target.ownerType,
                ownerId: target.ownerId
            })),
            {
                title,
                body: message,
                data: {
                    type: 'admin_broadcast',
                    broadcastId: String(broadcast._id),
                    link
                }
            }
        );
    }

    emitRealtimeNotifications(inAppTargets, broadcast);

    return {
        broadcast,
        targetPreview: resolvedTargets.slice(0, 10)
    };
};

export const getBroadcastNotifications = async ({ page = 1, limit = 10 } = {}) => {
    const { skip, ...meta } = paginationMeta({ page, limit });

    const [items, total] = await Promise.all([
        BroadcastNotification.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(meta.limit)
            .populate('createdBy', 'name email')
            .lean(),
        BroadcastNotification.countDocuments({})
    ]);

    return {
        items: items.map((item) => ({
            ...item,
            targetLabel:
                item.targetType === 'CUSTOM'
                    ? `${Number(item.targetCount || item.targets?.length || 0)} selected recipients`
                    : OWNER_LABEL_MAP[item.targetType] || item.targetType
        })),
        pagination: {
            page: meta.page,
            limit: meta.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / meta.limit))
        }
    };
};

export const deleteBroadcastNotification = async (broadcastId) => {
    const normalizedId = toObjectId(broadcastId, 'broadcastId');
    const broadcast = await BroadcastNotification.findByIdAndDelete(normalizedId).lean();

    if (!broadcast) {
        throw new NotFoundError('Broadcast notification not found');
    }

    const [foodDeleteResult, sellerDeleteResult] = await Promise.all([
        FoodNotification.deleteMany({ broadcastId: normalizedId }),
        SellerNotification.deleteMany({ key: `broadcast:${String(normalizedId)}` })
    ]);

    return {
        broadcast,
        deletedInboxCount: Number(foodDeleteResult?.deletedCount || 0) + Number(sellerDeleteResult?.deletedCount || 0)
    };
};
