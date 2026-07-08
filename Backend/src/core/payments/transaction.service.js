import mongoose from 'mongoose';
import { Transaction } from './models/transaction.model.js';
import { FoodUserWallet } from '../../modules/food/user/models/userWallet.model.js';
import { FoodRestaurantWallet } from '../../modules/food/restaurant/models/restaurantWallet.model.js';
import { FoodDeliveryWallet } from '../../modules/food/delivery/models/deliveryWallet.model.js';
import { FoodAdminWallet } from '../../modules/food/admin/models/adminWallet.model.js';
import { logger } from '../../utils/logger.js';

/**
 * Resolve the wallet model + id-field for a given entity.
 * Returns { Model, filter } so callers can findOne/updateOne generically.
 */
function resolveWallet(entityType, entityId) {
    switch (entityType) {
        case 'user': {
            const id = new mongoose.Types.ObjectId(entityId);
            return { Model: FoodUserWallet, filter: { userId: id }, idField: 'userId' };
        }
        case 'restaurant': {
            const id = new mongoose.Types.ObjectId(entityId);
            return { Model: FoodRestaurantWallet, filter: { restaurantId: id }, idField: 'restaurantId' };
        }
        case 'deliveryBoy': {
            const id = new mongoose.Types.ObjectId(entityId);
            return { Model: FoodDeliveryWallet, filter: { deliveryPartnerId: id }, idField: 'deliveryPartnerId' };
        }
        case 'admin':
            return { Model: FoodAdminWallet, filter: { key: 'platform' }, idField: 'key' };
        default:
            throw new Error(`Unknown entityType: ${entityType}`);
    }
}

/** Fixed ObjectId for admin entity used in Transaction documents (singleton) */
const ADMIN_ENTITY_OID = new mongoose.Types.ObjectId('000000000000000000000001');

/**
 * Ensure wallet exists, creating it if needed. Returns the wallet document.
 */
export async function ensureWallet(entityType, entityId) {
    const { Model, filter, idField } = resolveWallet(entityType, entityId);
    let wallet = await Model.findOne(filter);
    if (!wallet) {
        const createPayload = { ...filter, balance: 0 };
        wallet = await Model.create(createPayload);
    }
    return wallet;
}

/**
 * Get balance for an entity wallet.
 */
export async function getBalance(entityType, entityId) {
    const wallet = await ensureWallet(entityType, entityId);
    return {
        balance: Number(wallet.balance) || 0,
        lockedAmount: Number(wallet.lockedAmount) || 0,
        availableBalance: (Number(wallet.balance) || 0) - (Number(wallet.lockedAmount) || 0)
    };
}

/**
 * CORE ATOMIC OPERATION: Record a transaction AND update wallet balance
 * in a single MongoDB transaction. This is the ONLY way to change wallet balances.
 *
 * @param {Object} payload
 * @param {string} payload.entityType - 'user' | 'restaurant' | 'deliveryBoy' | 'admin'
 * @param {string} payload.entityId - ObjectId of the entity
 * @param {string} payload.type - 'credit' | 'debit'
 * @param {number} payload.amount - positive amount
 * @param {string} payload.description - human readable
 * @param {string} [payload.category] - transaction category
 * @param {string} [payload.orderId] - linked order
 * @param {string} [payload.paymentId] - linked payment
 * @param {Object} [payload.metadata] - extra data
 * @returns {Object} { transaction, wallet }
 */
/**
 * Record a transaction within an existing MongoDB session (caller manages commit).
 * Backward-compatible addition — existing recordTransaction() behaviour unchanged.
 */
export async function recordTransactionWithSession(payload, session) {
    const {
        entityType, entityId, type, amount,
        description = '', category = 'other',
        orderId = null, paymentId = null,
        metadata = undefined, module = 'food'
    } = payload;

    if (!session) throw new Error('session is required for recordTransactionWithSession');
    if (!['credit', 'debit'].includes(type)) throw new Error('type must be credit or debit');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be positive');

    const { Model, filter } = resolveWallet(entityType, entityId);

    let wallet = await Model.findOne(filter).session(session);
    if (!wallet) {
        [wallet] = await Model.create([{ ...filter, balance: 0 }], { session });
    }

    const currentBalance = Number(wallet.balance) || 0;
    const newBalance = type === 'credit'
        ? currentBalance + amount
        : currentBalance - amount;

    if (type === 'debit' && entityType !== 'admin' && newBalance < 0) {
        throw new Error(`Insufficient balance. Current: ${currentBalance}, Debit: ${amount}`);
    }

    const entityOid = entityType === 'admin'
        ? ADMIN_ENTITY_OID
        : new mongoose.Types.ObjectId(entityId);

    const [txn] = await Transaction.create([{
        paymentId: paymentId ? new mongoose.Types.ObjectId(paymentId) : null,
        orderId: orderId ? new mongoose.Types.ObjectId(orderId) : null,
        entityType,
        entityId: entityOid,
        type,
        amount,
        balanceAfter: newBalance,
        currency: 'INR',
        status: 'completed',
        description,
        category,
        module,
        metadata
    }], { session });

    if (type === 'credit') {
        if (entityType === 'restaurant' || entityType === 'deliveryBoy') {
            await Model.updateOne(filter, {
                $set: { balance: newBalance },
                $inc: { totalEarnings: amount }
            }, { session });
        } else if (entityType === 'admin') {
            await Model.updateOne(filter, {
                $set: { balance: newBalance },
                $inc: { totalRevenue: amount }
            }, { session });
        } else {
            await Model.updateOne(filter, { $set: { balance: newBalance } }, { session });
        }
    } else {
        await Model.updateOne(filter, { $set: { balance: newBalance } }, { session });
    }

    if (entityType === 'user') {
        const { FoodUser } = await import('../../core/users/user.model.js');
        await FoodUser.updateOne({ _id: entityOid }, { $set: { walletBalance: newBalance } }, { session });
    }

    return {
        transaction: txn.toObject(),
        wallet: { balance: newBalance }
    };
}

export async function recordTransaction(payload) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await recordTransactionWithSession(payload, session);
        await session.commitTransaction();
        logger.info(
            `Transaction recorded: ${payload.type} ${payload.amount} INR for ${payload.entityType}:${payload.entityId} → balance ${result.wallet.balance}`,
        );
        return result;
    } catch (err) {
        await session.abortTransaction();
        logger.error(`recordTransaction failed: ${err.message}`);
        throw err;
    } finally {
        session.endSession();
    }
}

/**
 * List transactions for an entity with pagination.
 */
export async function getTransactionsByEntity(entityType, entityId, { page = 1, limit = 20 } = {}) {
    const skip = (Math.max(1, page) - 1) * limit;
    const entityOid = entityType === 'admin'
        ? ADMIN_ENTITY_OID
        : new mongoose.Types.ObjectId(entityId);
    const filter = {
        entityType,
        entityId: entityOid
    };

    const [docs, total] = await Promise.all([
        Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Transaction.countDocuments(filter)
    ]);

    return {
        transactions: docs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
}

/**
 * Get transactions for a specific order across all entities.
 */
export async function getTransactionsByOrder(orderId) {
    return Transaction.find({ orderId: new mongoose.Types.ObjectId(orderId) })
        .sort({ createdAt: -1 })
        .lean();
}
