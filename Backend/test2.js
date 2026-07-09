import { config } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { FoodRestaurant } from './src/modules/food/restaurant/models/restaurant.model.js';

async function run() {
    await connectDB();
    const all = await FoodRestaurant.find({}).lean();
    console.log('Total:', all.length);
    console.log('Approved & Listed:', all.filter(r => r.status === 'approved' && r.isListed).length);
    const z = "69b85a63fb04545984776cdb";
    console.log('Approved & Listed & ZoneMatch:', all.filter(r => r.status === 'approved' && r.isListed && String(r.zoneId) === z).length);
    await disconnectDB();
}
run().catch(console.error);
