import { sendResponse } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import * as zoneService from '../services/zone.service.js';

export const listZones = asyncHandler(async (req, res) => {
    const data = await zoneService.listZones(req.query);
    return sendResponse(res, 200, 'Zones fetched successfully', data);
});

export const getZoneById = asyncHandler(async (req, res) => {
    const zone = await zoneService.getZoneById(req.params.id);
    return sendResponse(res, 200, 'Zone fetched successfully', { zone });
});

export const createZone = asyncHandler(async (req, res) => {
    const zone = await zoneService.createZone(req.body, req.user);
    return sendResponse(res, 201, 'Zone created successfully', { zone });
});

export const updateZone = asyncHandler(async (req, res) => {
    const zone = await zoneService.updateZone(req.params.id, req.body, req.user);
    return sendResponse(res, 200, 'Zone updated successfully', { zone });
});

export const patchZoneStatus = asyncHandler(async (req, res) => {
    const zone = await zoneService.updateZoneStatus(req.params.id, req.body, req.user);
    return sendResponse(res, 200, 'Zone status updated successfully', { zone });
});

export const deleteZone = asyncHandler(async (req, res) => {
    const result = await zoneService.deleteZone(req.params.id, req.user);
    return sendResponse(res, 200, 'Zone deleted successfully', result);
});

export const listZoneDropdown = asyncHandler(async (req, res) => {
    const zones = await zoneService.listZoneDropdown();
    return sendResponse(res, 200, 'Zones fetched successfully', { zones });
});
