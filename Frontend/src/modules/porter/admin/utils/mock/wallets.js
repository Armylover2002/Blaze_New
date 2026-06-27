import { MOCK_DRIVERS } from "./drivers";

function makeWallet(driver, i) {
  const todayEarnings = 350 + ((i * 173) % 2400);
  const pending = i % 5 === 0 ? 0 : 400 + ((i * 211) % 3500);
  const completed = 12000 + ((i * 1337) % 60000);
  const lastSettle = new Date(2026, 5, 1 + (i % 24));
  return {
    id: `WLT-${String(2001 + i)}`,
    driverId: driver.id,
    driverName: driver.name,
    photo: driver.photo,
    vehicle: driver.vehicle,
    walletBalance: driver.walletBalance,
    todayEarnings,
    pending,
    completed,
    lastSettlement: lastSettle.toISOString(),
    status: pending > 0 ? "pending" : "settled",
  };
}

export const MOCK_WALLETS = MOCK_DRIVERS.map((d, i) => makeWallet(d, i));

export const MOCK_WALLET_SUMMARY = {
  availableBalance: MOCK_WALLETS.reduce((a, w) => a + w.walletBalance, 0),
  pendingPayout: MOCK_WALLETS.reduce((a, w) => a + w.pending, 0),
  todayEarnings: MOCK_WALLETS.reduce((a, w) => a + w.todayEarnings, 0),
  totalEarnings: MOCK_WALLETS.reduce((a, w) => a + w.completed, 0),
};

export const MOCK_SETTLEMENT_HISTORY = Array.from({ length: 12 }, (_, i) => {
  const d = MOCK_DRIVERS[i % MOCK_DRIVERS.length];
  const date = new Date(2026, 5, 24 - i);
  return {
    id: `STL-${String(5001 + i)}`,
    driverName: d.name,
    amount: 2000 + ((i * 877) % 12000),
    method: ["UPI", "Bank Transfer", "IMPS"][i % 3],
    reference: `TXN${String(889000 + i * 113)}`,
    date: date.toISOString(),
    status: i % 7 === 3 ? "processing" : "completed",
  };
});
