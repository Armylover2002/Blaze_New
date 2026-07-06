import mongoose from 'mongoose';
import { Transaction } from '../../../../core/payments/models/transaction.model.js';
import { recordTransaction, recordTransactionWithSession } from '../../../../core/payments/transaction.service.js';
import { PorterEarning } from '../models/porterEarning.model.js';
import { logger } from '../../../../utils/logger.js';

async function findExistingPorterTxn({ orderId, category, entityType, idempotencyKey }) {
    if (!idempotencyKey || !orderId) return null;
    return Transaction.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        module: 'porter',
        category,
        entityType,
        'metadata.idempotencyKey': idempotencyKey,
        status: 'completed',
    }).lean();
}

export async function recordPorterTransactionIdempotent(payload, { session = null } = {}) {
    const idempotencyKey = payload.metadata?.idempotencyKey;
    const existing = await findExistingPorterTxn({
        orderId: payload.orderId,
        category: payload.category,
        entityType: payload.entityType,
        idempotencyKey,
    });
    if (existing) {
        return { transaction: existing, wallet: null, duplicate: true };
    }

    if (session) {
        return recordTransactionWithSession(payload, session);
    }
    return recordTransaction(payload);
}

/**
 * Atomically settle driver earning, platform fee, and porter_earnings row.
 * Idempotent — safe for double-click complete and concurrent requests.
 */
export async function settlePorterOrderEarningsAtomic(order) {
    const orderId = order._id || order.id;
    const existing = await PorterEarning.findOne({ orderId }).lean();
    if (existing?.settledAt) return existing;

    const partnerId = order.dispatch?.deliveryPartnerId;
    if (!partnerId) return null;

    const earning = Number(order.pricing?.driverEarning) || 0;
    const fee = Number(order.pricing?.platformFee) || 0;
    const orderIdStr = String(orderId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const claim = await PorterEarning.findOneAndUpdate(
            {
                orderId,
                $or: [{ settledAt: null }, { settledAt: { $exists: false } }],
            },
            {
                $setOnInsert: {
                    orderId,
                    orderNumber: order.orderNumber,
                    deliveryPartnerId: partnerId,
                    userId: order.userId,
                    module: 'porter',
                },
            },
            { upsert: true, new: true, session },
        );

        if (claim.settledAt) {
            await session.abortTransaction();
            return claim;
        }

        let driverTxnId = null;

        if (earning > 0) {
            const driverResult = await recordPorterTransactionIdempotent({
                entityType: 'deliveryBoy',
                entityId: String(partnerId),
                type: 'credit',
                amount: earning,
                description: `Porter order ${order.orderNumber} — trip earning`,
                category: 'delivery_earning',
                orderId: orderIdStr,
                module: 'porter',
                metadata: {
                    module: 'porter',
                    orderNumber: order.orderNumber,
                    paymentMethod: order.payment?.method,
                    idempotencyKey: `porter:driver:${orderIdStr}`,
                },
            }, { session });
            driverTxnId = driverResult?.transaction?._id || driverResult?.transaction?.id;
        }

        if (fee > 0) {
            await recordPorterTransactionIdempotent({
                entityType: 'admin',
                entityId: 'platform',
                type: 'credit',
                amount: fee,
                description: `Porter order ${order.orderNumber} — platform fee`,
                category: 'platform_fee',
                orderId: orderIdStr,
                module: 'porter',
                metadata: {
                    module: 'porter',
                    orderNumber: order.orderNumber,
                    driverEarning: earning,
                    idempotencyKey: `porter:platform:${orderIdStr}`,
                },
            }, { session });
        }

        claim.orderNumber = order.orderNumber;
        claim.deliveryPartnerId = partnerId;
        claim.userId = order.userId;
        claim.grossFare = order.pricing?.total || 0;
        claim.commission = order.pricing?.commission || 0;
        claim.platformFee = fee;
        claim.tax = order.pricing?.serviceTax || 0;
        claim.netEarning = earning;
        claim.distanceKm = order.route?.distanceKm;
        claim.paymentMethod = order.payment?.method;
        claim.walletTransactionId = driverTxnId;
        claim.settledAt = new Date();
        await claim.save({ session });

        await session.commitTransaction();
        logger.info(`[PorterWallet] Settled earnings for order ${order.orderNumber}`);
        return claim;
    } catch (err) {
        await session.abortTransaction();
        if (err?.code === 11000) {
            return PorterEarning.findOne({ orderId });
        }
        throw err;
    } finally {
        session.endSession();
    }
}
