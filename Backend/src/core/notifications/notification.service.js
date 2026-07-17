import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../auth/errors.js';
import { FoodNotification } from './models/notification.model.js';
import { computeNotificationExpiresAt } from './utils/notificationTtl.js';
import { bulkWriteInChunks } from './utils/bulkWriteChunks.js';
import { buildPaginationMeta, buildPaginationOptions } from '../../utils/helpers.js';

const normalizePagination = ({ page = 1, limit = 20 } = {}) => {
    const { page: nextPage, limit: nextLimit, skip } = buildPaginationOptions(
        { page, limit },
        { defaultLimit: 20, maxLimit: 100 }
    );

    return { page: nextPage, limit: nextLimit, skip };
};

const normalizeOwnerType = (role) => {
    const normalized = String(role || '').trim().toUpperCase();
    if (normalized === 'USER') return 'USER';
    if (normalized === 'RESTAURANT') return 'RESTAURANT';
    if (normalized === 'DELIVERY_PARTNER') return 'DELIVERY_PARTNER';
    return null;
};

const ensureObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
        throw new ValidationError(`${fieldName} is invalid`);
    }
    return new mongoose.Types.ObjectId(String(value));
};

/** Strip duplicated / PII profile fields from inbox metadata. */
const sanitizeNotificationMetadata = (metadata = {}) => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }
    const next = { ...metadata };
    delete next.ownerLabel;
    delete next.ownerSubLabel;
    delete next.label;
    delete next.subLabel;
    delete next.phone;
    delete next.email;
    // broadcastId lives on the document root — do not keep a duplicate copy in metadata.
    delete next.broadcastId;
    return next;
};

export const resolveNotificationOwnerFromRequest = (user = {}) => {
    const ownerType = normalizeOwnerType(user?.role);
    const ownerId = user?.userId || user?._id || null;

    if (!ownerType || !ownerId) {
        throw new ValidationError('Authenticated notification owner not found');
    }

    return {
        ownerType,
        ownerId: ensureObjectId(ownerId, 'ownerId')
    };
};

export const createInboxNotifications = async ({
    notifications = [],
    returnDocuments = true
} = {}) => {
    const rows = Array.isArray(notifications)
        ? notifications.filter((item) => item?.ownerType && item?.ownerId && item?.title && item?.message)
        : [];

    if (!rows.length) return [];

    const expiresAt = computeNotificationExpiresAt(new Date());

    const operations = rows.map((item) => {
        const hasExplicitBroadcastId =
            item.broadcastId && mongoose.Types.ObjectId.isValid(String(item.broadcastId));
        const trimmedLink = String(item.link || '').trim();
        const trimmedCategory = String(item.category || '').trim();
        const metadata = sanitizeNotificationMetadata(item.metadata);
        const payload = {
            ownerType: item.ownerType,
            ownerId: ensureObjectId(item.ownerId, 'ownerId'),
            title: String(item.title).trim(),
            message: String(item.message).trim(),
            source: 'ADMIN_BROADCAST',
            ...(trimmedLink ? { link: trimmedLink } : {}),
            // Persist category only when explicitly provided (e.g. category/dining flows).
            ...(trimmedCategory ? { category: trimmedCategory } : {}),
            ...(Object.keys(metadata).length ? { metadata } : {})
        };

        if (hasExplicitBroadcastId) {
            payload.broadcastId = new mongoose.Types.ObjectId(String(item.broadcastId));
        } else {
            // Unique compound index on { broadcastId, ownerType, ownerId } requires a value.
            payload.broadcastId = new mongoose.Types.ObjectId();
        }

        return {
            updateOne: {
                filter: hasExplicitBroadcastId
                    ? {
                        broadcastId: payload.broadcastId,
                        ownerType: payload.ownerType,
                        ownerId: payload.ownerId
                    }
                    : {
                        ownerType: payload.ownerType,
                        ownerId: payload.ownerId,
                        title: payload.title,
                        message: payload.message,
                        source: payload.source
                    },
                update: {
                    $set: {
                        ...payload,
                        dismissedAt: null
                    },
                    $setOnInsert: {
                        isRead: false,
                        readAt: null,
                        expiresAt
                    }
                },
                upsert: true
            }
        };
    });

    await bulkWriteInChunks(FoodNotification.collection, operations, { ordered: false });

    if (!returnDocuments) {
        return [];
    }

    const ids = rows
        .map((item) => item.broadcastId)
        .filter((value) => value && mongoose.Types.ObjectId.isValid(String(value)))
        .map((value) => new mongoose.Types.ObjectId(String(value)));

    if (ids.length > 0) {
        return FoodNotification.find({ broadcastId: { $in: ids } })
            .select('-__v')
            .sort({ createdAt: -1 })
            .lean();
    }

    return [];
};

export const getInboxNotifications = async ({
    ownerType,
    ownerId,
    page = 1,
    limit = 20,
    contextModule
} = {}) => {
    const normalizedOwnerType = normalizeOwnerType(contextModule || ownerType);
    const normalizedOwnerId = ensureObjectId(ownerId, 'ownerId');
    const { skip, ...meta } = normalizePagination({ page, limit });

    const filter = {
        ownerType: normalizedOwnerType,
        ownerId: normalizedOwnerId,
        dismissedAt: null
    };

    const [items, total, unreadCount] = await Promise.all([
        FoodNotification.find(filter)
            .select(
                'ownerType ownerId title message link category source broadcastId metadata isRead readAt createdAt updatedAt'
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(meta.limit)
            .lean(),
        FoodNotification.countDocuments(filter),
        FoodNotification.countDocuments({
            ...filter,
            isRead: false
        })
    ]);

    return {
        items,
        pagination: {
            page: meta.page,
            limit: meta.limit,
            total,
            ...buildPaginationMeta({ totalItems: total, page: meta.page, limit: meta.limit })
        },
        unreadCount
    };
};

export const markNotificationAsRead = async ({ notificationId, ownerType, ownerId } = {}) => {
    const notification = await FoodNotification.findOneAndUpdate(
        {
            _id: ensureObjectId(notificationId, 'notificationId'),
            ownerType: normalizeOwnerType(ownerType),
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        },
        { new: true }
    )
        .select(
            'ownerType ownerId title message link category source broadcastId metadata isRead readAt createdAt updatedAt'
        )
        .lean();

    if (!notification) {
        throw new NotFoundError('Notification not found');
    }

    return notification;
};

export const dismissNotification = async ({ notificationId, ownerType, ownerId } = {}) => {
    const notification = await FoodNotification.findOneAndUpdate(
        {
            _id: ensureObjectId(notificationId, 'notificationId'),
            ownerType: normalizeOwnerType(ownerType),
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                dismissedAt: new Date(),
                isRead: true,
                readAt: new Date()
            }
        },
        { new: true }
    )
        .select('_id dismissedAt isRead readAt')
        .lean();

    if (!notification) {
        throw new NotFoundError('Notification not found');
    }

    return notification;
};

export const dismissAllNotifications = async ({ ownerType, ownerId } = {}) => {
    const result = await FoodNotification.updateMany(
        {
            ownerType: normalizeOwnerType(ownerType),
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                dismissedAt: new Date(),
                isRead: true,
                readAt: new Date()
            }
        }
    );

    return {
        modifiedCount: Number(result?.modifiedCount || 0)
    };
};
