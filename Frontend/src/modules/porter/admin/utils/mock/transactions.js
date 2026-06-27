import { MOCK_DRIVERS } from "./drivers";

const customers = ["Aarav Sharma", "Diya Patel", "Rohan Gupta", "Priya Nair", "Kabir Mehta", "Neha Joshi", "Arjun Reddy", "Tara Iyer", "Varun Kapoor", "Meera Das"];
const methods = ["UPI", "Card", "Wallet", "Cash", "Net Banking"];
const gateways = ["Razorpay", "PayU", "Cashfree", "Stripe", "Manual"];
const statuses = ["success", "success", "success", "pending", "failed", "refunded"];

function makeTxn(i) {
  const driver = MOCK_DRIVERS[i % MOCK_DRIVERS.length];
  const amount = 150 + ((i * 89) % 1800);
  const commission = Math.round(amount * 0.14);
  const tax = Math.round(amount * 0.05);
  const created = new Date();
  created.setHours(created.getHours() - i * 3);
  const method = methods[i % methods.length];
  return {
    id: `TXN-${String(70001 + i)}`,
    orderId: `ORD-${String(900 + (i % 25) + 1)}`,
    driverName: driver.name,
    customer: customers[i % customers.length],
    amount,
    commission,
    tax,
    netPayout: amount - commission - tax,
    paymentMethod: method,
    gateway: method === "Cash" ? "Manual" : gateways[i % gateways.length],
    status: statuses[i % statuses.length],
    createdAt: created.toISOString(),
  };
}

export const MOCK_TRANSACTIONS = Array.from({ length: 40 }, (_, i) => makeTxn(i));

export const MOCK_TXN_SUMMARY = {
  grossRevenue: MOCK_TRANSACTIONS.reduce((a, t) => a + t.amount, 0),
  totalCommission: MOCK_TRANSACTIONS.reduce((a, t) => a + t.commission, 0),
  totalTax: MOCK_TRANSACTIONS.reduce((a, t) => a + t.tax, 0),
  netPayout: MOCK_TRANSACTIONS.reduce((a, t) => a + t.netPayout, 0),
};

export const PAYMENT_METHODS = ["UPI", "Card", "Wallet", "Cash", "Net Banking"];
export const TXN_STATUSES = ["success", "pending", "failed", "refunded"];
