import { MOCK_BANNER_IMAGES } from "./mockImages";

const titles = [
  "Monsoon Delivery Offer", "Same Day Logistics", "Fleet Expansion", "New Zone Launch",
  "Driver Referral Bonus", "Corporate Shipping", "Festive Surge Discount", "EV Fleet Promo",
  "Weekend Express", "First Order Free", "B2B Partnership", "Insurance Add-on",
  "Heavy Load Special", "City-Wide Coverage", "Premium Support", "App Update",
  "Safety First Campaign", "Green Logistics", "Night Delivery", "Loyalty Rewards",
];
const types = ["promotional", "announcement", "seasonal", "feature"];
const targets = ["Home", "Orders", "Driver App", "Customer App", "Checkout", "Dashboard"];

function computeStatus(start, end) {
  const now = Date.now();
  if (now < start.getTime()) return "scheduled";
  if (now > end.getTime()) return "expired";
  return "active";
}

function makeBanner(i) {
  const start = new Date(2026, (i % 12), 1 + (i % 20));
  const end = new Date(start);
  end.setDate(end.getDate() + 14 + (i % 30));
  const status = i % 17 === 0 ? "inactive" : computeStatus(start, end);
  return {
    id: `BNR-${String(3001 + i)}`,
    title: titles[i % titles.length],
    type: types[i % types.length],
    target: targets[i % targets.length],
    priority: 1 + (i % 5),
    image: MOCK_BANNER_IMAGES[i % MOCK_BANNER_IMAGES.length],
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    status,
    linkUrl: `/promo/${3001 + i}`,
  };
}

export const MOCK_BANNERS = Array.from({ length: 20 }, (_, i) => makeBanner(i + 1));

export const BANNER_TYPES = types;
export const BANNER_TARGETS = targets;
