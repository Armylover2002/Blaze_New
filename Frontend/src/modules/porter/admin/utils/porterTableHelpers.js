/** Shared client-side table helpers for Porter admin mock pages. */

export function filterBySearch(items, query, keys = []) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((row) =>
    keys.some((key) => {
      const val = row[key];
      return val != null && String(val).toLowerCase().includes(q);
    })
  );
}

export function sortItems(items, sortKey, sortDir = "asc", accessors = {}) {
  if (!sortKey) return items;
  const dir = sortDir === "desc" ? -1 : 1;
  const getVal = accessors[sortKey] || ((row) => row[sortKey]);
  return [...items].sort((a, b) => {
    const av = getVal(a);
    const bv = getVal(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
}

export function paginateItems(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
  };
}

export function formatCurrency(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatDateTime(iso) {
  if (!iso) return "Not available";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}
