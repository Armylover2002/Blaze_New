const PAGE_SIZE = 100;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const slugifyCategory = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const extractCategoryApiError = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || error?.message || fallback;

export const validateCategoryImage = (file) => {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, WebP, and GIF images are allowed';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Image must be smaller than 5MB';
  }
  return null;
};

export const buildCategoryFormData = (formData, type, imageFile) => {
  const data = new FormData();
  data.append('type', type);

  Object.entries(formData).forEach(([key, value]) => {
    if (key === 'type') return;
    if (key === 'parentId') {
      if (type === 'header' || value === null || value === undefined || value === '' || value === 'null') {
        return;
      }
    }
    if (value === null || value === undefined) return;
    data.append(key, value);
  });

  if (imageFile) {
    data.append('image', imageFile);
  }

  return data;
};

export const fetchAllCategoriesByType = async (adminApi, type) => {
  const firstRes = await adminApi.getCategories({ type, page: 1, limit: PAGE_SIZE });
  const firstPayload = firstRes.data?.result || {};
  const firstItems = Array.isArray(firstPayload.items)
    ? firstPayload.items
    : firstRes.data?.results || [];
  const total = Number(firstPayload.total || firstItems.length || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (totalPages === 1) {
    return firstItems;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      adminApi.getCategories({ type, page: index + 2, limit: PAGE_SIZE }),
    ),
  );

  return [
    ...firstItems,
    ...remainingResponses.flatMap((response) => {
      const payload = response.data?.result || {};
      return Array.isArray(payload.items) ? payload.items : response.data?.results || [];
    }),
  ];
};

export const bulkDeleteCategories = async (adminApi, ids = []) => {
  const results = await Promise.allSettled(ids.map((id) => adminApi.deleteCategory(id)));
  const failed = results.filter((result) => result.status === 'rejected');
  return {
    deleted: results.length - failed.length,
    failed: failed.length,
    firstError: failed[0]?.reason,
  };
};
