import mongoose from 'mongoose';
import { Seller } from '../models/seller.model.js';
import { SellerNotification } from '../models/sellerNotification.model.js';
import { FoodNotification } from '../../../../core/notifications/models/notification.model.js';
import { notifyOwnerSafely, notifyAdminsSafely } from '../../../../core/notifications/firebase.service.js';
import { computeNotificationExpiresAt } from '../../../../core/notifications/utils/notificationTtl.js';
import { bulkWriteInChunks } from '../../../../core/notifications/utils/bulkWriteChunks.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateLabel = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const nextDay = (date) => new Date(date.getTime() + DAY_MS);

// Reusable logic for any license type
const buildNotificationPayloads = (seller, expiryType, licenseNumberField, licenseName) => {
    const expiryDate = seller[expiryType] ? new Date(seller[expiryType]) : null;
    if (!expiryDate) return null;

    const sellerName = seller?.shopInfo?.shopName || seller?.businessName || seller?.ownerName || 'Seller';
    const ownerName = seller?.ownerName || 'Seller owner';
    const expiryLabel = toDateLabel(expiryDate);
    const title = `${licenseName} Expired`;
    const licenseNumber = seller?.compliance?.[licenseNumberField] || seller[licenseNumberField] || 'N/A';
    const message = `${sellerName} ${licenseName} expired on ${expiryLabel}. Owner: ${ownerName}. Lic No: ${licenseNumber}.`;

    return {
        expiryIso: expiryDate.toISOString(),
        title,
        message,
        link: '/seller/profile',
        category: 'compliance',
        source: 'LICENSE_EXPIRY',
        metadata: {
            sellerId: String(seller?._id || ''),
            sellerName,
            ownerName,
            ownerPhone: seller?.ownerPhone || seller?.phone || '',
            licenseNumber,
            licenseName,
            expiryDate: expiryDate.toISOString(),
            licenseType: expiryType
        }
    };
};

const buildAdminSummary = (seller, expiryType, licenseNumberField, licenseName) => {
    const payload = buildNotificationPayloads(seller, expiryType, licenseNumberField, licenseName);
    if (!payload) return null;
    
    return {
        id: `${expiryType}-expired-${String(seller?._id || '')}`,
        sellerId: String(seller?._id || ''),
        sellerName: payload.metadata.sellerName,
        ownerName: payload.metadata.ownerName,
        ownerPhone: payload.metadata.ownerPhone,
        licenseNumber: payload.metadata.licenseNumber,
        licenseName,
        expiryDate: payload.metadata.expiryDate,
        expiryLabel: toDateLabel(new Date(payload.metadata.expiryDate)),
        title: payload.title,
        message: payload.message,
        createdAt: payload.metadata.expiryDate,
        path: '/admin/quick-commerce/sellers', // Or pending sellers / active sellers
        licenseType: expiryType
    };
};

export const listExpiredSellerLicenses = async () => {
    const today = startOfToday();
    const threshold = nextDay(today);

    // Find sellers where any of the 3 licenses are expiring
    const sellers = await Seller.find({
        status: { $in: ['approved', 'pending_approval'] },
        $or: [
            { fssaiExpiry: { $lt: threshold } },
            { medicalLicenseExpiry: { $lt: threshold } },
            { shopLicenseExpiry: { $lt: threshold } }
        ]
    }).lean();

    const results = [];
    sellers.forEach(seller => {
        if (seller.fssaiExpiry && new Date(seller.fssaiExpiry) < threshold) {
            results.push(buildAdminSummary(seller, 'fssaiExpiry', 'fssaiNumber', 'FSSAI License'));
        }
        if (seller.medicalLicenseExpiry && new Date(seller.medicalLicenseExpiry) < threshold) {
            results.push(buildAdminSummary(seller, 'medicalLicenseExpiry', 'medicalLicenseNumber', 'Medical License'));
        }
        if (seller.shopLicenseExpiry && new Date(seller.shopLicenseExpiry) < threshold) {
            results.push(buildAdminSummary(seller, 'shopLicenseExpiry', 'shopLicenseNumber', 'Shop License'));
        }
    });

    // Sort descending by expiry date
    return results.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));
};

export const syncExpiredSellerLicenseNotifications = async () => {
    const expiredList = await listExpiredSellerLicenses();
    
    const candidates = [];
    for (const summary of expiredList) {
        if (!summary.sellerId || !mongoose.Types.ObjectId.isValid(summary.sellerId)) {
            continue;
        }
        candidates.push(summary);
    }

    if (!candidates.length) {
        return {
            totalExpired: 0,
            createdCount: 0
        };
    }

    const now = new Date();
    const expiresAt = computeNotificationExpiresAt(now);

    // 1. Create operations for Seller App (SellerNotification)
    const sellerOps = candidates.map((summary) => ({
        updateOne: {
            filter: {
                sellerId: new mongoose.Types.ObjectId(summary.sellerId),
                source: 'LICENSE_EXPIRY',
                'metadata.expiryDate': summary.expiryDate,
                'metadata.licenseType': summary.licenseType
            },
            update: {
                $setOnInsert: {
                    sellerId: new mongoose.Types.ObjectId(summary.sellerId),
                    title: summary.title,
                    message: summary.message,
                    link: '/seller/profile',
                    category: 'compliance',
                    source: 'LICENSE_EXPIRY',
                    metadata: {
                        licenseNumber: summary.licenseNumber,
                        licenseName: summary.licenseName,
                        expiryDate: summary.expiryDate,
                        licenseType: summary.licenseType
                    },
                    isRead: false,
                    readAt: null,
                    createdAt: now,
                    updatedAt: now,
                    expiresAt
                }
            },
            upsert: true
        }
    }));

    // 2. Create operations for Admin App (FoodNotification with ownerType: 'SELLER')
    const adminOps = candidates.map((summary) => ({
        updateOne: {
            filter: {
                ownerType: 'SELLER',
                ownerId: new mongoose.Types.ObjectId(summary.sellerId),
                source: 'LICENSE_EXPIRY',
                'metadata.expiryDate': summary.expiryDate,
                'metadata.licenseType': summary.licenseType
            },
            update: {
                $setOnInsert: {
                    ownerType: 'SELLER',
                    ownerId: new mongoose.Types.ObjectId(summary.sellerId),
                    title: summary.title,
                    message: summary.message,
                    link: summary.path,
                    category: 'compliance',
                    source: 'LICENSE_EXPIRY',
                    metadata: {
                        sellerId: summary.sellerId,
                        sellerName: summary.sellerName,
                        ownerName: summary.ownerName,
                        ownerPhone: summary.ownerPhone,
                        licenseNumber: summary.licenseNumber,
                        licenseName: summary.licenseName,
                        expiryDate: summary.expiryDate,
                        licenseType: summary.licenseType
                    },
                    isRead: false,
                    readAt: null,
                    dismissedAt: null,
                    createdAt: now,
                    updatedAt: now,
                    expiresAt
                }
            },
            upsert: true
        }
    }));

    const [sellerResult, adminResult] = await Promise.all([
        bulkWriteInChunks(SellerNotification.collection, sellerOps, { ordered: false }),
        bulkWriteInChunks(FoodNotification.collection, adminOps, { ordered: false })
    ]);

    const sellerUpserted = sellerResult?.upsertedIds || {};
    const adminUpserted = adminResult?.upsertedIds || {};
    
    // We only send push notifications for newly inserted records
    const newlyCreated = Object.keys(sellerUpserted);
    
    if (newlyCreated.length > 0) {
        // Send firebase pushes for each newly created one
        for (const [indexStr, docId] of Object.entries(sellerUpserted)) {
            const index = Number(indexStr);
            const summary = candidates[index];
            
            // Notify seller
            notifyOwnerSafely({
                ownerId: summary.sellerId,
                title: summary.title,
                body: summary.message,
                data: {
                    click_action: 'FLUTTER_NOTIFICATION_CLICK',
                    type: 'LICENSE_EXPIRY',
                    licenseType: summary.licenseType
                }
            });
        }
        
        // Notify Admins about the new expirations
        notifyAdminsSafely({
            title: 'Seller License Expired',
            body: `${newlyCreated.length} seller license(s) expired.`,
            data: {
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                type: 'LICENSE_EXPIRY'
            }
        });
    }

    return {
        totalExpired: candidates.length,
        createdCount: newlyCreated.length
    };
};
