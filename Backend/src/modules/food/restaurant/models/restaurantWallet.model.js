import mongoose from 'mongoose';
import { embeddedWalletTransactionSchema } from '../../../../core/payments/models/embeddedWalletTransaction.schema.js';

/**
 * RestaurantWallet — ancillary balances for a restaurant (NOT order payout ledger).
 *
 * ORDER EARNINGS SOURCE OF TRUTH: `food_transactions` (`amounts.restaurantShare`,
 * `settlement.*`). Delivered/captured orders never credit this collection.
 * Withdrawable order payout is computed in `restaurantFinance.service.js` from
 * unsettled `food_transactions`, not from `balance`.
 *
 * This document is created lazily (upsert) when:
 * - Referral rewards are credited (admin approval)
 * - Subscription wallet top-up / daily-pass flows run
 * - Withdrawal request or admin approval locks/settles shares
 *
 * Field roles:
 * - `balance` / `referralEarnings` — referral rewards only (debited when a
 *   withdrawal consumes referral balance)
 * - `subscriptionBalance` — daily pass / subscription fees (separate product wallet)
 * - `totalSettled` — cumulative order + referral amount marked paid via withdrawals
 * - `totalEarnings` — lifetime referral (and universal `creditWallet` credits only)
 *
 * Embedded `transactions` complements the universal `transactions` collection
 * for referral debits and manual credits — not per-order delivery credits.
 */
const restaurantWalletSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            unique: true
        },
        /** Referral reward balance (not order earnings). See model header. */
        balance: { type: Number, default: 0 },
        /** Subscription wallet balance for daily passes and future fees */
        subscriptionBalance: { type: Number, default: 0, min: 0 },
        /** Amount locked for pending settlements (cannot be withdrawn) */
        lockedAmount: { type: Number, default: 0, min: 0 },
        /** Lifetime referral (and creditWallet) earnings — excludes order share */
        totalEarnings: { type: Number, default: 0, min: 0 },
        /** Referral rewards available for withdrawal (included in payout math) */
        referralEarnings: { type: Number, default: 0, min: 0 },
        /** Cumulative amount consumed by approved restaurant withdrawals */
        totalSettled: { type: Number, default: 0, min: 0 },
        /** Per-document balance mutation history (same wallet document) */
        transactions: { type: [embeddedWalletTransactionSchema], default: [] }
    },
    { collection: 'food_restaurant_wallets', timestamps: true }
);

export const FoodRestaurantWallet = mongoose.model('FoodRestaurantWallet', restaurantWalletSchema, 'food_restaurant_wallets');
