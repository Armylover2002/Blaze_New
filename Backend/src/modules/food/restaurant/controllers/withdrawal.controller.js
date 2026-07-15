import mongoose from 'mongoose';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { getRestaurantFinance } from '../services/restaurantFinance.service.js';

function resolveBankDetails(bodyBank, restaurant) {
    const fromBody = bodyBank && typeof bodyBank === 'object' ? bodyBank : {};
    return {
        accountNumber: fromBody.accountNumber || restaurant?.accountNumber || '',
        ifscCode: fromBody.ifscCode || restaurant?.ifscCode || '',
        bankName: fromBody.bankName || restaurant?.bankName || '',
        accountHolderName:
            fromBody.accountHolderName || restaurant?.accountHolderName || '',
    };
}

function hasUsableBankDetails(bank) {
    return Boolean(
        String(bank?.accountNumber || '').trim() &&
            String(bank?.ifscCode || '').trim() &&
            String(bank?.accountHolderName || '').trim()
    );
}

async function notifySafely(targets, payload) {
    try {
        const { notifyOwnersSafely } = await import(
            '../../../../core/notifications/firebase.service.js'
        );
        await notifyOwnersSafely(targets, payload);
    } catch (e) {
        console.error('Withdrawal notification failed:', e?.message || e);
    }
}

export const createWithdrawalRequestController = async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
        const restaurantId = req.user?.userId;
        const { amount, bankDetails } = req.body;

        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');
        if (!amount || amount <= 0) return sendError(res, 400, 'Invalid withdrawal amount');

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return sendError(res, 400, 'Invalid restaurant ID');
        }

        const rid = new mongoose.Types.ObjectId(restaurantId);
        const restaurant = await FoodRestaurant.findById(rid)
            .select('restaurantName accountNumber ifscCode bankName accountHolderName')
            .lean();
        if (!restaurant) return sendError(res, 404, 'Restaurant not found');

        const resolvedBank = resolveBankDetails(bankDetails, restaurant);
        if (!hasUsableBankDetails(resolvedBank)) {
            return sendError(
                res,
                400,
                'Complete bank account details (account number, IFSC, holder name) before withdrawing'
            );
        }

        let withdrawal;

        await session.withTransaction(async () => {
            // Serialize concurrent creates for this restaurant via wallet row lock
            await FoodRestaurantWallet.findOneAndUpdate(
                { restaurantId: rid },
                { $setOnInsert: { restaurantId: rid } },
                { upsert: true, session, new: true }
            );

            const finance = await getRestaurantFinance(restaurantId);
            const availableBalance = finance?.currentCycle?.estimatedPayout || 0;

            if (amount > availableBalance) {
                const err = new Error(
                    `Insufficient balance. Available: ₹${availableBalance}`
                );
                err.statusCode = 400;
                throw err;
            }

            const [created] = await FoodRestaurantWithdrawal.create(
                [
                    {
                        restaurantId: rid,
                        amount,
                        bankDetails: resolvedBank,
                        status: 'pending',
                    },
                ],
                { session }
            );
            withdrawal = created;
        });

        await notifySafely(
            [{ ownerType: 'ADMIN', ownerId: 'GLOBAL' }],
            {
                title: 'New withdrawal request',
                body: `${restaurant.restaurantName || 'Restaurant'} requested ₹${Number(amount).toFixed(2)}`,
                data: {
                    type: 'withdraw_request',
                    withdrawalId: String(withdrawal._id),
                    restaurantId: String(rid),
                },
            }
        );

        return sendResponse(res, 201, 'Withdrawal request submitted successfully', withdrawal);
    } catch (error) {
        if (error?.statusCode === 400 || /Insufficient balance/i.test(error?.message || '')) {
            return sendError(res, 400, error.message);
        }
        next(error);
    } finally {
        session.endSession();
    }
};

export const listMyWithdrawalsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');

        const withdrawals = await FoodRestaurantWithdrawal.find({ restaurantId })
            .sort({ createdAt: -1 })
            .lean();

        return sendResponse(res, 200, 'Withdrawals fetched successfully', withdrawals);
    } catch (error) {
        next(error);
    }
};

/** Cancel a pending withdrawal — releases the soft lock on available balance */
export const cancelMyWithdrawalController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const { id } = req.params;
        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return sendError(res, 400, 'Invalid withdrawal ID');
        }

        const cancelled = await FoodRestaurantWithdrawal.findOneAndUpdate(
            {
                _id: id,
                restaurantId,
                status: 'pending',
            },
            {
                $set: {
                    status: 'cancelled',
                    rejectionReason: 'Cancelled by restaurant',
                    processedAt: new Date(),
                },
            },
            { new: true }
        ).lean();

        if (!cancelled) {
            return sendError(res, 400, 'Only pending withdrawals can be cancelled');
        }

        return sendResponse(res, 200, 'Withdrawal cancelled successfully', cancelled);
    } catch (error) {
        next(error);
    }
};
