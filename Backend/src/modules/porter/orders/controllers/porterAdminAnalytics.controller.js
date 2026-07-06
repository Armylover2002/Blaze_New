import { sendResponse } from '../../../../utils/response.js';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import {
    getPorterDashboardStats,
    getPorterReportsStats,
    getPorterAdminTransactions,
} from '../services/porter-admin-analytics.service.js';

export const getPorterDashboard = asyncHandler(async (req, res) => {
    const data = await getPorterDashboardStats();
    return sendResponse(res, 200, 'Porter dashboard fetched', data);
});

export const getPorterReports = asyncHandler(async (req, res) => {
    const data = await getPorterReportsStats({ range: req.query.range });
    return sendResponse(res, 200, 'Porter reports fetched', data);
});

export const getPorterTransactions = asyncHandler(async (req, res) => {
    const data = await getPorterAdminTransactions(req.query);
    return sendResponse(res, 200, 'Porter transactions fetched', data);
});
