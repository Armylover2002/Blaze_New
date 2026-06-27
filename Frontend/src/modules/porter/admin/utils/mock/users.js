const firstNames = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Anaya", "Diya", "Priya", "Riya", "Saanvi", "Rohan", "Arjun", "Kavya", "Meera", "Neha", "Pooja", "Sahil", "Tara", "Uday", "Varun", "Yash", "Zara", "Naina", "Ira", "Dev", "Krish", "Laxmi", "Manish", "Nidhi", "Omkar"];
const lastNames = ["Sharma", "Verma", "Patel", "Gupta", "Reddy", "Nair", "Iyer", "Mehta", "Joshi", "Kapoor", "Malhotra", "Chopra", "Bose", "Das", "Rao"];
const cities = ["Mumbai", "Thane", "Navi Mumbai", "Kalyan"];
const zones = ["Andheri East", "Bandra West", "Powai", "Thane West", "Borivali", "Dadar", "Vashi", "Malad", "Goregaon", "Colaba"];

function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ffedeb,ede9fe,dbeafe,dcfce7`;
}

function makeUser(i) {
  const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
  const totalOrders = 8 + ((i * 7) % 140);
  const cancelled = i % 9;
  const completed = totalOrders - cancelled;
  const verified = i % 6 !== 2;
  const active = i % 11 !== 4;
  const reg = new Date(2023, i % 12, ((i * 3) % 27) + 1);
  return {
    id: `CUST-${String(1001 + i)}`,
    name,
    avatar: avatarUrl(name),
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
    phone: `+91 9${String(800000000 + i * 314159).slice(0, 9)}`,
    city: cities[i % cities.length],
    zone: zones[i % zones.length],
    address: `Flat ${100 + i}, ${zones[i % zones.length]}, ${cities[i % cities.length]}`,
    totalOrders,
    completedOrders: completed,
    cancelledOrders: cancelled,
    walletBalance: 250 + ((i * 137) % 9000),
    rating: (3.8 + (i % 13) * 0.1).toFixed(1),
    verification: verified ? "verified" : "pending",
    status: active ? "active" : "inactive",
    registeredAt: reg.toISOString(),
    recentOrders: Array.from({ length: 3 }, (_, k) => ({
      id: `ORD-${String(900 + i + k)}`,
      goodsType: ["Documents", "Electronics", "Groceries", "Furniture", "Parcels"][(i + k) % 5],
      amount: 120 + ((i + k) * 45) % 700,
      status: ["delivered", "in_transit", "cancelled"][(i + k) % 3],
    })),
  };
}

export const MOCK_USERS = Array.from({ length: 30 }, (_, i) => makeUser(i));
