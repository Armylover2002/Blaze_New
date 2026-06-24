import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import { QuickCategory } from './src/modules/quick-commerce/models/category.model.js';

async function migrate() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/blaze';
    if (!mongoUri) {
      console.error('MongoDB URI not found in environment variables.');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const result = await QuickCategory.updateMany(
      { type: 'subcategory', approvalStatus: 'pending' },
      { 
        $set: { 
          approvalStatus: 'approved',
          approvedAt: new Date()
        } 
      }
    );

    console.log(`Migration completed successfully.`);
    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
