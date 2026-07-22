import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';

export const VALID_BUSINESS_TYPES = ['quick_commerce', 'pharmacy', 'food', 'default'];
export const VALID_CATEGORY_TYPES = ['header', 'category', 'subcategory'];

const PARENT_TYPE_BY_CHILD = {
  category: 'header',
  subcategory: 'category',
};

export const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const validateCategoryImageFile = (file) => {
  if (!file) return null;

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024;

  if (!allowedMimes.includes(file.mimetype)) {
    return 'Only JPEG, PNG, WebP, and GIF images are allowed';
  }
  if (file.size > maxSize) {
    return 'Image must be smaller than 5MB';
  }
  return null;
};

export const generateUniqueSlug = async (rawSlug, excludeId = null) => {
  const baseSlug = slugify(rawSlug);
  if (!baseSlug) return null;

  const buildQuery = (slug) => {
    const query = { slug };
    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      query._id = { $ne: excludeId };
    }
    return query;
  };

  const exactMatch = await QuickCategory.findOne(buildQuery(baseSlug)).select('_id').lean();
  if (!exactMatch) return baseSlug;

  for (let counter = 2; counter <= 1000; counter += 1) {
    const candidate = `${baseSlug}-${counter}`;
    const exists = await QuickCategory.findOne(buildQuery(candidate)).select('_id').lean();
    if (!exists) return candidate;
  }

  throw new Error('Unable to generate a unique slug');
};

export const wouldCreateCircularParent = async (categoryId, newParentId) => {
  if (!categoryId || !newParentId) return false;

  let current = String(newParentId);
  const visited = new Set([String(categoryId)]);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);

    const parent = await QuickCategory.findById(current).select('parentId').lean();
    if (!parent?.parentId) break;
    current = String(parent.parentId);
  }

  return false;
};

export const validateCategoryParent = async (type, parentId, categoryId = null) => {
  const normalizedType = String(type || 'header').toLowerCase();

  if (!VALID_CATEGORY_TYPES.includes(normalizedType)) {
    return { error: 'Invalid category type' };
  }

  if (normalizedType === 'header') {
    if (parentId && parentId !== 'null') {
      return { error: 'Header categories cannot have a parent' };
    }
    return { parentId: null, type: normalizedType };
  }

  const expectedParentType = PARENT_TYPE_BY_CHILD[normalizedType];
  if (!parentId || !mongoose.isValidObjectId(parentId)) {
    return { error: `${normalizedType} requires a valid parent category` };
  }

  const parent = await QuickCategory.findById(parentId).select('type').lean();
  if (!parent) {
    return { error: 'Parent category not found' };
  }

  if (parent.type !== expectedParentType) {
    return { error: `Parent must be a ${expectedParentType} category` };
  }

  if (categoryId && await wouldCreateCircularParent(categoryId, parentId)) {
    return { error: 'Cannot set parent: circular reference detected' };
  }

  return { parentId, type: normalizedType };
};

export const validateCategoryFields = ({
  name,
  type,
  businessType,
  adminCommission,
  handlingFees,
  status,
}) => {
  if (!name || !String(name).trim()) {
    return 'name is required';
  }

  const normalizedType = String(type || 'header').toLowerCase();
  if (!VALID_CATEGORY_TYPES.includes(normalizedType)) {
    return 'Invalid category type';
  }

  if (normalizedType === 'header' && businessType && !VALID_BUSINESS_TYPES.includes(businessType)) {
    return 'Invalid business type';
  }

  const commission = Number(adminCommission);
  if (adminCommission !== undefined && adminCommission !== '' && (!Number.isFinite(commission) || commission < 0)) {
    return 'adminCommission must be a non-negative number';
  }

  const fees = Number(handlingFees);
  if (handlingFees !== undefined && handlingFees !== '' && (!Number.isFinite(fees) || fees < 0)) {
    return 'handlingFees must be a non-negative number';
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return 'status must be active or inactive';
  }

  return null;
};
