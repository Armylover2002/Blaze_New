import DriverSvg from "@/assets/mock/vehicles/driver1.svg";

const firstNames = ["Ravi", "Amit", "Suresh", "Vikas", "Karan", "Rahul", "Raj", "Sunil", "Deepak", "Manoj", "Anil", "Prakash", "Nitin", "Sanjay", "Arun", "Vivek", "Gaurav", "Rohit", "Ashok", "Mahesh"];
const lastNames = ["Kumar", "Singh", "Sharma", "Patel", "Yadav", "Verma", "Gupta", "Joshi", "Mehta", "Reddy"];
const vehicles = ["Mini Truck", "Bike", "Pickup", "Three Wheeler", "EV Loader", "Tempo", "Van"];
const zones = ["Andheri East", "Bandra West", "Powai", "Thane", "Borivali", "Dadar", "Vashi", "Chembur", "Malad", "Goregaon"];

function makeDriver(index) {
  const id = `DRV-${String(100 + index).padStart(3, "0")}`;
  const name = `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`;
  const online = index % 4 !== 1;
  const verified = index % 5 !== 3;
  return {
    id,
    photo: DriverSvg,
    name,
    phone: `+91 98${String(70000000 + index * 137).slice(0, 8)}`,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@porter.local`,
    vehicle: vehicles[index % vehicles.length],
    currentZone: zones[index % zones.length],
    availability: online ? "available" : "offline",
    ordersCompleted: 45 + index * 12,
    rating: (4.2 + (index % 8) * 0.1).toFixed(1),
    onlineStatus: online ? "online" : "offline",
    verification: verified ? "verified" : "pending",
    walletBalance: 1200 + index * 340,
    status: online ? "active" : "inactive",
    joinedAt: `2024-${String((index % 12) + 1).padStart(2, "0")}-15`,
    address: `${zones[index % zones.length]}, Mumbai`,
    licenseNumber: `MH-${String(10 + index).padStart(2, "0")}-${String(2020 + (index % 4))}`,
    vehicleNumber: `MH${String(1 + (index % 9)).padStart(2, "0")}AB${String(1000 + index)}`,
  };
}

export const MOCK_DRIVERS = Array.from({ length: 20 }, (_, i) => makeDriver(i + 1));
