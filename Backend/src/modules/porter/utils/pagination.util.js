import { buildPaginationOptions, buildPaginatedResult } from '../../../utils/helpers.js';

export const parseListQuery = (query = {}) => {
    const { page, limit, skip } = buildPaginationOptions(query);
    const search = String(query.search || '').trim().slice(0, 120);
    const status = query.status && String(query.status) !== 'all'
        ? String(query.status).trim()
        : '';
    const sortBy = String(query.sortBy || 'createdAt').trim();
    const sortOrder = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo = query.createdTo ? new Date(query.createdTo) : null;

    return {
        page,
        limit,
        skip,
        search,
        status,
        sortBy,
        sortOrder,
        createdFrom: createdFrom && !Number.isNaN(createdFrom.getTime()) ? createdFrom : null,
        createdTo: createdTo && !Number.isNaN(createdTo.getTime()) ? createdTo : null,
        city: query.city && String(query.city) !== 'all' ? String(query.city).trim() : '',
        category: query.category && String(query.category) !== 'all' ? String(query.category).trim() : '',
        discountType: query.discountType && String(query.discountType) !== 'all'
            ? String(query.discountType).trim()
            : '',
        verification: query.verification && String(query.verification) !== 'all'
            ? String(query.verification).trim()
            : '',
    };
};

export const buildDateRangeFilter = (createdFrom, createdTo) => {
    if (!createdFrom && !createdTo) return null;
    const range = {};
    if (createdFrom) range.$gte = createdFrom;
    if (createdTo) {
        const end = new Date(createdTo);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
    }
    return range;
};

export const toPorterPagination = ({ docs, total, page, limit }) => {
    const base = buildPaginatedResult({ docs, total, page, limit });
    const pages = base.meta.totalPages;
    return {
        records: docs,
        page: base.meta.page,
        pages,
        total: base.meta.total,
        hasNext: page < pages,
        hasPrev: page > 1,
        limit: base.meta.limit,
    };
};

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
