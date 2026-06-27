export const DELIVERY_VEHICLES = [
  {
    id: "bike",
    name: "Bike",
    icon: "🏍️",
    tagline: "Documents & small parcels up to 5 km",
    maxWeightKg: 20,
    minWeightKg: 0,
    baseFare: 40,
    perKm: 8,
    perMin: 1.2,
    etaMins: 8,
    surge: 1,
  },
  {
    id: "scooter",
    name: "Scooter",
    icon: "🛵",
    tagline: "Quick city deliveries for light goods",
    maxWeightKg: 50,
    minWeightKg: 0,
    baseFare: 45,
    perKm: 9,
    perMin: 1.3,
    etaMins: 10,
    surge: 1,
  },
  {
    id: "auto",
    name: "Auto Rickshaw",
    icon: "🛺",
    tagline: "Best for medium parcels & local routes",
    maxWeightKg: 100,
    minWeightKg: 0,
    baseFare: 55,
    perKm: 11,
    perMin: 1.5,
    etaMins: 12,
    surge: 1.1,
  },
  {
    id: "pickup",
    name: "Pickup",
    icon: "🛻",
    tagline: "Furniture, appliances & bulk items",
    maxWeightKg: 500,
    minWeightKg: 50,
    baseFare: 120,
    perKm: 18,
    perMin: 2.5,
    etaMins: 18,
    surge: 1,
  },
  {
    id: "minitruck",
    name: "Mini Truck",
    icon: "🚚",
    tagline: "Heavy goods & business shipments",
    maxWeightKg: 1500,
    minWeightKg: 100,
    baseFare: 180,
    perKm: 22,
    perMin: 3,
    etaMins: 22,
    surge: 1,
  },
  {
    id: "tempo",
    name: "Tempo",
    icon: "🚛",
    tagline: "Large loads & warehouse transfers",
    maxWeightKg: 2500,
    minWeightKg: 500,
    baseFare: 250,
    perKm: 28,
    perMin: 3.5,
    etaMins: 28,
    surge: 1.15,
  },
  {
    id: "truck",
    name: "Truck",
    icon: "🚛",
    tagline: "Industrial & commercial freight",
    maxWeightKg: 9000,
    minWeightKg: 1500,
    baseFare: 400,
    perKm: 35,
    perMin: 4,
    etaMins: 35,
    surge: 1,
  },
  {
    id: "evvan",
    name: "EV Van",
    icon: "⚡",
    tagline: "Eco-friendly mid-size deliveries",
    maxWeightKg: 300,
    minWeightKg: 0,
    baseFare: 95,
    perKm: 15,
    perMin: 2,
    etaMins: 15,
    surge: 1,
  },
];

export function getVehicleById(id) {
  return DELIVERY_VEHICLES.find((v) => v.id === id) || DELIVERY_VEHICLES[2];
}

export function estimateDeliveryCost(vehicleId, distanceKm = 8.2, durationMin = 26) {
  const v = getVehicleById(vehicleId);
  const raw = v.baseFare + distanceKm * v.perKm + durationMin * v.perMin;
  return Math.round(raw * (v.surge || 1));
}

export function recommendVehicle(weightKg = 20) {
  const eligible = DELIVERY_VEHICLES.filter(v => weightKg >= v.minWeightKg && weightKg <= v.maxWeightKg);
  if (eligible.length > 0) {
    return eligible.reduce((prev, curr) => (prev.baseFare < curr.baseFare ? prev : curr));
  }
  const sorted = [...DELIVERY_VEHICLES].sort((a, b) => a.maxWeightKg - b.maxWeightKg);
  return sorted.find((v) => v.maxWeightKg >= weightKg) || sorted[sorted.length - 1];
}
