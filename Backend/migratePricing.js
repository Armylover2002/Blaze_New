import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blaze';

async function runMigration() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const db = mongoose.connection.db;
        const collection = db.collection('porter_pricing');

        console.log('Starting migration for porter_pricing collection...');

        const result = await collection.updateMany(
            {},
            {
                $unset: {
                    zoneId: "",
                    pricingConfigured: "",
                    displayOrder: ""
                }
            }
        );

        console.log(`Migration completed successfully.`);
        console.log(`Matched: ${result.matchedCount}`);
        console.log(`Modified: ${result.modifiedCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

runMigration();
