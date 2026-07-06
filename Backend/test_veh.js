import mongoose from 'mongoose';
import { PorterVehicle } from './src/modules/porter/models/porterVehicle.model.js';

await mongoose.connect('mongodb://127.0.0.1:27017/blaze');
const all = await PorterVehicle.find().lean();
console.log(JSON.stringify(all, null, 2));
process.exit(0);
