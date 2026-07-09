import { sendResponse } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import * as mapsService from '../services/maps.service.js';
import {
    validateReverseGeocodeQuery,
    validatePlaceIdQuery,
    validateRoutePreviewBody,
    validateQuotePreviewBody,
    validateZoneDetectQuery,
} from '../validators/maps.validator.js';
import { detectPorterZoneForPoint } from '../orders/services/porter-zone-lookup.service.js';

export const reverseGeocode = asyncHandler(async (req, res) => {
    const { lat, lng } = validateReverseGeocodeQuery(req.query);
    const data = await mapsService.reverseGeocode(lat, lng);
    return sendResponse(res, 200, 'Address resolved successfully', data);
});

export const getPlaceDetails = asyncHandler(async (req, res) => {
    const { placeId } = validatePlaceIdQuery(req.query);
    const data = await mapsService.getPlaceDetails(placeId);
    return sendResponse(res, 200, 'Place details fetched successfully', data);
});

export const getRoutePreview = asyncHandler(async (req, res) => {
    const payload = validateRoutePreviewBody(req.body);
    const data = await mapsService.getRoutePreview(payload);
    return sendResponse(res, 200, 'Route preview fetched successfully', data);
});

export const getQuotePreview = asyncHandler(async (req, res) => {
    const payload = validateQuotePreviewBody(req.body);
    const data = await mapsService.getQuotePreview(payload);
    return sendResponse(res, 200, 'Quote preview fetched successfully', data);
});

export const detectPorterZone = asyncHandler(async (req, res) => {
    const { lat, lng } = validateZoneDetectQuery(req.query);
    const data = await detectPorterZoneForPoint(lat, lng);
    return sendResponse(
        res,
        200,
        data.status === 'IN_SERVICE' ? 'Zone detected' : 'Out of service',
        data,
    );
});
