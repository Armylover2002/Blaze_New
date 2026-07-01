import('dotenv').then(async (dotenv) => {
    dotenv.config();
    const mongoose = await import('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const { PorterVehicle } = await import('./src/modules/porter/models/porterVehicle.model.js');
    const { createCoupon } = await import('./src/modules/porter/services/coupon.service.js');
    
    const baseFilter = { isDeleted: { $ne: true } };
    const vehicles = await PorterVehicle.find({ ...baseFilter, status: 'active' }).select('_id name').lean();
    console.log('Vehicles from DB:', vehicles.map(v => v.name));
    
    process.exit(0);
});
