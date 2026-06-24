import mongoose from 'mongoose';

const foodDeliveryCashDepositSchema = new mongoose.Schema({
    deliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodDeliveryPartner',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'razorpay', 'upi', 'bank_transfer'],
        default: 'cash'
    },
    depositType: {
        type: String,
        enum: ['online', 'admin_bank', 'admin_upi', 'admin_qr', 'zone_hub', 'quick_zone_hub'],
        default: 'online'
    },
    paymentProof: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Restaurant_Accepted', 'Restaurant_Rejected', 'Seller_Accepted', 'Seller_Rejected'],
        default: 'Pending',
        index: true
    },
    restaurantProof: {
        type: String,
        default: ''
    },
    restaurantNote: {
        type: String,
        default: ''
    },
    restaurantProcessedAt: {
        type: Date
    },
    sellerProof: {
        type: String,
        default: ''
    },
    sellerNote: {
        type: String,
        default: ''
    },
    sellerProcessedAt: {
        type: Date
    },
    razorpayOrderId: {
        type: String,
        default: ''
    },
    razorpayPaymentId: String,
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminNote: String,
    zoneId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodZone',
        default: null
    },
    zoneHubRestaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodRestaurant',
        default: null
    },
    quickZoneId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'quick_zone',
        default: null
    },
    quickZoneHubSellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        default: null
    }
}, { 
    collection: 'food_delivery_cash_deposits', 
    timestamps: true 
});

foodDeliveryCashDepositSchema.index({ createdAt: -1 });

export const FoodDeliveryCashDeposit = mongoose.model('FoodDeliveryCashDeposit', foodDeliveryCashDepositSchema, 'food_delivery_cash_deposits');
