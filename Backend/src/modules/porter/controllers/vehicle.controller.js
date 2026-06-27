import { sendResponse } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import * as vehicleService from '../services/vehicle.service.js';

export const listVehicles = asyncHandler(async (req, res) => {
    const data = await vehicleService.listVehicles(req.query);
    return sendResponse(res, 200, 'Vehicles fetched successfully', data);
});

export const getVehicleById = asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.getVehicleById(req.params.id);
    return sendResponse(res, 200, 'Vehicle fetched successfully', { vehicle });
});

export const createVehicle = asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.createVehicle(req.body, req.user, req.file);
    return sendResponse(res, 201, 'Vehicle created successfully', { vehicle });
});

export const updateVehicle = asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.updateVehicle(req.params.id, req.body, req.user, req.file);
    return sendResponse(res, 200, 'Vehicle updated successfully', { vehicle });
});

export const patchVehicleStatus = asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.updateVehicleStatus(req.params.id, req.body, req.user);
    return sendResponse(res, 200, 'Vehicle status updated successfully', { vehicle });
});

export const deleteVehicle = asyncHandler(async (req, res) => {
    const result = await vehicleService.deleteVehicle(req.params.id, req.user);
    return sendResponse(res, 200, 'Vehicle deleted successfully', result);
});

export const listVehicleDropdown = asyncHandler(async (req, res) => {
    const vehicles = await vehicleService.listVehicleDropdown();
    return sendResponse(res, 200, 'Vehicles fetched successfully', { vehicles });
});

export const uploadVehicleIcon = asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.uploadVehicleIcon(req.params.id, req.file, req.user);
    return sendResponse(res, 200, 'Vehicle icon uploaded successfully', { vehicle });
});
