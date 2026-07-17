import mongoose from 'mongoose';
import { embeddedWalletTransactionSchema } from '../../../../core/payments/models/embeddedWalletTransaction.schema.js';

/**
 * RestaurantWallet — tracks the financial balance for each restaurant.
 * Credited when orders are delivered; debited when settlements are processed.
 * Embedded `transactions` complements the universal `transactions` collection.
 */
const restaurantWalletSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            unique: true
        },
        balance: { type: Number, default: 0 },
        /** Subscription wallet balance for daily passes and future fees */
        subscriptionBalance: { type: Number, default: 0, min: 0 },
        /** Amount locked for pending settlements (cannot be withdrawn) */
        lockedAmount: { type: Number, default: 0, min: 0 },
        /** Lifetime earnings */
        totalEarnings: { type: Number, default: 0, min: 0 },
        /** Total amount from referrals */
        referralEarnings: { type: Number, default: 0, min: 0 },
        /** Total amount already settled/paid out */
        totalSettled: { type: Number, default: 0, min: 0 },
        /** Per-document balance mutation history (same wallet document) */
        transactions: { type: [embeddedWalletTransactionSchema], default: [] }
    },
    { collection: 'food_restaurant_wallets', timestamps: true }
);

export const FoodRestaurantWallet = mongoose.model('FoodRestaurantWallet', restaurantWalletSchema, 'food_restaurant_wallets');
