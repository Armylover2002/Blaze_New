import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/blaze_db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    try {
        const FoodRestaurant = mongoose.model('FoodRestaurant', new mongoose.Schema({}, { strict: false }));
        
        const all = await FoodRestaurant.find({}).lean();
        console.log(`Total restaurants: ${all.length}`);
        if (all.length > 0) {
            console.log('Sample restaurant properties:');
            console.log('status:', all[0].status);
            console.log('isListed:', all[0].isListed);
            console.log('zoneId:', all[0].zoneId);
            console.log('location:', JSON.stringify(all[0].location));
        }

        const approvedAndListed = await FoodRestaurant.find({ status: 'approved', isListed: true }).lean();
        console.log(`Approved & Listed: ${approvedAndListed.length}`);

        const approvedListedAndZone = await FoodRestaurant.find({ 
            status: 'approved', 
            isListed: true,
            zoneId: all[0]?.zoneId
        }).lean();
        console.log(`Approved & Listed & Zone (${all[0]?.zoneId}): ${approvedListedAndZone.length}`);

        console.log('Checking why restaurants are not matching query filter...');
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
});
