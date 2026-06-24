export const downloadCsv = (rows, filename) => {
  if (!rows?.length) return false;

  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

export const formatInr = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

export const formatOrderDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getTransactionBreakdown = (order) => {
  const userPaid = Number(order.amount || order.total || 0);
  const platformFee = Number(order.pricing?.platformFee || 0);
  const deliveryFee = Number(order.pricing?.deliveryFee || 0);
  const tax = Number(order.pricing?.tax || order.pricing?.gst || 0);
  const handling = Number(order.pricing?.handlingFee || 0);
  const subtotal = Number(
    order.pricing?.subtotal || userPaid - platformFee - deliveryFee - tax - handling,
  );
  const sellerEarned = Math.max(0, userPaid - platformFee - deliveryFee);
  const riderEarned = deliveryFee;
  const adminEarned = platformFee;

  return {
    userPaid,
    platformFee,
    deliveryFee,
    tax,
    handling,
    subtotal,
    sellerEarned,
    riderEarned,
    adminEarned,
  };
};

export const buildTransactionCsvRows = (orders = []) => {
  const headers = [
    'Order ID',
    'Order Date',
    'Customer',
    'Seller',
    'Delivery Boy',
    'User Paid',
    'Subtotal',
    'Delivery Fee',
    'Tax/GST',
    'Platform Fee',
    'Seller Earned',
    'Rider Earned',
    'Admin Earned',
    'Status',
  ];

  const rows = orders.map((order) => {
    const breakdown = getTransactionBreakdown(order);
    const status = order.status === 'delivered' ? 'Completed' : (order.status || 'N/A');

    return [
      order.orderId || order.orderNumber || order._id || order.id || '',
      formatOrderDate(order.createdAt),
      order.customer?.name || 'Guest',
      order.storeName || order.seller?.shopName || order.seller?.name || 'Unknown',
      order.dispatch?.rider?.name || order.rider?.name || 'N/A',
      formatInr(breakdown.userPaid),
      formatInr(breakdown.subtotal),
      formatInr(breakdown.deliveryFee),
      formatInr(breakdown.tax),
      formatInr(breakdown.platformFee),
      formatInr(breakdown.sellerEarned),
      formatInr(breakdown.riderEarned),
      formatInr(breakdown.adminEarned),
      status,
    ];
  });

  return [headers, ...rows];
};

export const buildCustomerCsvRows = (customers = []) => {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Total Orders',
    'Total Spend',
    'Status',
    'Joined Date',
    'Last Order Date',
  ];

  const rows = customers.map((customer) => [
    customer.name || 'N/A',
    customer.email || 'N/A',
    customer.phone || 'N/A',
    String(customer.totalOrders ?? 0),
    formatInr(customer.totalSpent),
    customer.status || 'N/A',
    customer.joinedDate ? formatOrderDate(customer.joinedDate) : 'N/A',
    customer.lastOrderDate ? formatOrderDate(customer.lastOrderDate) : 'Never',
  ]);

  return [headers, ...rows];
};
