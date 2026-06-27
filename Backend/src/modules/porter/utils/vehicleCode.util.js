import { PorterVehicle } from '../models/porterVehicle.model.js';

export async function generateVehicleCode() {
    const latest = await PorterVehicle.findOne({
        isDeleted: { $ne: true },
        vehicleCode: { $regex: /^VH\d+$/ },
    })
        .sort({ vehicleCode: -1 })
        .select('vehicleCode')
        .lean();

    if (!latest?.vehicleCode) {
        return 'VH001';
    }

    const next = Number.parseInt(String(latest.vehicleCode).replace(/\D/g, ''), 10) + 1;
    return `VH${String(next).padStart(3, '0')}`;
}
