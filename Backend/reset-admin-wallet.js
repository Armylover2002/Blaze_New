
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { FoodAdminWallet } from './src/modules/food/admin/models/adminWallet.model.js';
import { Transaction } from './src/core/payments/models/transaction.model.js';

// Load environment variables
config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/food-delivery');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Reset or recalculate admin wallet balance
const resetAdminWallet = async () => {
    await connectDB();

    try {
        console.log('Recalculating admin wallet balance from remaining transactions...');

        // 1. Get all admin transactions that still exist
        const adminTransactions = await Transaction.find({
            entityType: 'admin',
            status: 'completed'
        }).sort({ createdAt: 1 });

        // 2. Calculate total balance from transactions
        let calculatedBalance = 0;
        adminTransactions.forEach(txn => {
            if (txn.type === 'credit') {
                calculatedBalance += Number(txn.amount);
            } else if (txn.type === 'debit') {
                calculatedBalance -= Number(txn.amount);
            }
        });

        // 3. Find or create admin wallet
        let adminWallet = await FoodAdminWallet.findOne({ key: 'platform' });
        if (!adminWallet) {
            adminWallet = new FoodAdminWallet({ key: 'platform' });
        }

        // 4. Update wallet with calculated balance
        adminWallet.balance = calculatedBalance;
        await adminWallet.save();

        console.log('✅ Admin wallet updated successfully!');
        console.log('📊 New balance:', calculatedBalance);
        console.log('📋 Number of transactions used for calculation:', adminTransactions.length);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting admin wallet:', error);
        process.exit(1);
    }
};

// Run the function
resetAdminWallet();
