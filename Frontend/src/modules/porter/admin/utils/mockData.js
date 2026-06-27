import MiniTruckSvg from "@/assets/mock/vehicles/mini-truck.svg";
import PickupSvg from "@/assets/mock/vehicles/pickup.svg";
import BikeSvg from "@/assets/mock/vehicles/bike.svg";
import EvLoaderSvg from "@/assets/mock/vehicles/ev-loader.svg";
import TempoSvg from "@/assets/mock/vehicles/tempo.svg";
import VanSvg from "@/assets/mock/vehicles/van.svg";
import DriverSvg from "@/assets/mock/vehicles/driver1.svg";
import GenericGoodSvg from "@/assets/mock/goods/generic.svg";

export const GOODS_CATEGORIES = [
  "Documents", "Electronics", "Furniture", "Perishables", "Industrial", "Fragile", "Medical", "General",
];

export const MOCK_GOODS_TYPES = [
  { id: "GT-001", name: "Documents", code: "DOC", image: GenericGoodSvg, description: "Envelopes, contracts, legal papers and office documents.", category: "Documents", maxWeightKg: 5, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 1, allowedVehicles: ["VH003", "VH008"] },
  { id: "GT-002", name: "Electronics", code: "ELEC", image: GenericGoodSvg, description: "Mobile phones, laptops, accessories and small gadgets.", category: "Electronics", maxWeightKg: 25, fragileAllowed: true, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: true, status: "active", displayOrder: 2, allowedVehicles: ["VH001", "VH006", "VH012"] },
  { id: "GT-003", name: "Furniture", code: "FURN", image: GenericGoodSvg, description: "Chairs, tables, wardrobes and assembled furniture items.", category: "Furniture", maxWeightKg: 500, fragileAllowed: true, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 3, allowedVehicles: ["VH001", "VH002", "VH009"] },
  { id: "GT-004", name: "Medicines", code: "MED", image: GenericGoodSvg, description: "Pharmaceutical products requiring careful handling.", category: "Medical", maxWeightKg: 15, fragileAllowed: true, temperatureControlled: true, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 4, allowedVehicles: ["VH003", "VH008", "VH011"] },
  { id: "GT-005", name: "Groceries", code: "GROC", image: GenericGoodSvg, description: "Daily essentials, packaged foods and household items.", category: "Perishables", maxWeightKg: 40, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: true, insuranceRequired: false, status: "active", displayOrder: 5, allowedVehicles: ["VH003", "VH005", "VH010"] },
  { id: "GT-006", name: "Food", code: "FOOD", image: GenericGoodSvg, description: "Prepared meals, bakery items and restaurant deliveries.", category: "Perishables", maxWeightKg: 20, fragileAllowed: true, temperatureControlled: true, hazardous: false, perishable: true, insuranceRequired: false, status: "active", displayOrder: 6, allowedVehicles: ["VH003", "VH008", "VH011"] },
  { id: "GT-007", name: "Flowers", code: "FLWR", image: GenericGoodSvg, description: "Fresh bouquets and floral arrangements.", category: "Perishables", maxWeightKg: 8, fragileAllowed: true, temperatureControlled: true, hazardous: false, perishable: true, insuranceRequired: false, status: "active", displayOrder: 7, allowedVehicles: ["VH003", "VH008", "VH011"] },
  { id: "GT-008", name: "Fragile Items", code: "FRG", image: GenericGoodSvg, description: "Glassware, ceramics, mirrors and delicate goods.", category: "Fragile", maxWeightKg: 50, fragileAllowed: true, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: true, status: "active", displayOrder: 8, allowedVehicles: ["VH006", "VH012"] },
  { id: "GT-009", name: "Industrial Parts", code: "IND", image: GenericGoodSvg, description: "Machine components, spare parts and factory supplies.", category: "Industrial", maxWeightKg: 200, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 9, allowedVehicles: ["VH002", "VH009"] },
  { id: "GT-010", name: "Heavy Machinery", code: "MACH", image: GenericGoodSvg, description: "Large equipment requiring specialized vehicles.", category: "Industrial", maxWeightKg: 2000, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: true, status: "active", displayOrder: 10, allowedVehicles: ["VH009"] },
  { id: "GT-011", name: "Textiles", code: "TXT", image: GenericGoodSvg, description: "Garments, fabrics and fashion merchandise.", category: "General", maxWeightKg: 30, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 11, allowedVehicles: ["VH001", "VH005", "VH006"] },
  { id: "GT-012", name: "Hardware", code: "HDW", image: GenericGoodSvg, description: "Tools, fittings, plumbing and construction hardware.", category: "Industrial", maxWeightKg: 100, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 12, allowedVehicles: ["VH001", "VH002", "VH007"] },
  { id: "GT-013", name: "Parcels", code: "PRCL", image: GenericGoodSvg, description: "Standard e-commerce and courier parcels.", category: "General", maxWeightKg: 35, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 13, allowedVehicles: ["VH003", "VH008", "VH011"] },
  { id: "GT-014", name: "Chemicals", code: "CHEM", image: GenericGoodSvg, description: "Non-hazardous industrial chemicals in sealed containers.", category: "Industrial", maxWeightKg: 80, fragileAllowed: true, temperatureControlled: false, hazardous: true, perishable: false, insuranceRequired: true, status: "inactive", displayOrder: 14, allowedVehicles: ["VH006", "VH012"] },
  { id: "GT-015", name: "Appliances", code: "APPL", image: GenericGoodSvg, description: "Home appliances including TVs, fridges and washing machines.", category: "Electronics", maxWeightKg: 120, fragileAllowed: true, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: true, status: "active", displayOrder: 15, allowedVehicles: ["VH001", "VH002", "VH007"] },
  { id: "GT-016", name: "Books", code: "BKS", image: GenericGoodSvg, description: "Books, notebooks and office stationery supplies.", category: "General", maxWeightKg: 25, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 16, allowedVehicles: ["VH003", "VH008", "VH010"] },
  { id: "GT-017", name: "Construction Material", code: "CONS", image: GenericGoodSvg, description: "Cement, sand, bricks and raw building materials.", category: "Industrial", maxWeightKg: 1500, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 17, allowedVehicles: ["VH002", "VH009"] },
  { id: "GT-018", name: "Cosmetics", code: "COSM", image: GenericGoodSvg, description: "Beauty products, makeup and personal care.", category: "General", maxWeightKg: 15, fragileAllowed: true, temperatureControlled: true, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 18, allowedVehicles: ["VH003", "VH011", "VH012"] },
  { id: "GT-019", name: "Toys", code: "TOY", image: GenericGoodSvg, description: "Children's toys, games and sporting equipment.", category: "General", maxWeightKg: 20, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 19, allowedVehicles: ["VH001", "VH006", "VH010"] },
  { id: "GT-020", name: "Plants", code: "PLNT", image: GenericGoodSvg, description: "Live plants, saplings and gardening materials.", category: "Perishables", maxWeightKg: 50, fragileAllowed: true, temperatureControlled: false, hazardous: false, perishable: true, insuranceRequired: false, status: "active", displayOrder: 20, allowedVehicles: ["VH001", "VH006", "VH007"] },
  { id: "GT-021", name: "Jewelry", code: "JEWL", image: GenericGoodSvg, description: "High-value jewelry and precious stones.", category: "General", maxWeightKg: 5, fragileAllowed: true, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: true, status: "active", displayOrder: 21, allowedVehicles: ["VH006", "VH012"] },
  { id: "GT-022", name: "Artwork", code: "ART", image: GenericGoodSvg, description: "Paintings, sculptures and fine art pieces.", category: "Fragile", maxWeightKg: 40, fragileAllowed: true, temperatureControlled: true, hazardous: false, perishable: false, insuranceRequired: true, status: "active", displayOrder: 22, allowedVehicles: ["VH006", "VH012"] },
  { id: "GT-023", name: "Liquor", code: "LIQ", image: GenericGoodSvg, description: "Alcoholic beverages in glass bottles.", category: "Fragile", maxWeightKg: 60, fragileAllowed: true, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: true, status: "active", displayOrder: 23, allowedVehicles: ["VH001", "VH006", "VH012"] },
  { id: "GT-024", name: "Frozen Food", code: "FROZ", image: GenericGoodSvg, description: "Deep frozen perishables requiring active cooling.", category: "Perishables", maxWeightKg: 50, fragileAllowed: false, temperatureControlled: true, hazardous: false, perishable: true, insuranceRequired: false, status: "active", displayOrder: 24, allowedVehicles: ["VH011", "VH012"] },
  { id: "GT-025", name: "Scrap", code: "SCRP", image: GenericGoodSvg, description: "Metal scrap and recyclable waste materials.", category: "Industrial", maxWeightKg: 1000, fragileAllowed: false, temperatureControlled: false, hazardous: false, perishable: false, insuranceRequired: false, status: "active", displayOrder: 25, allowedVehicles: ["VH002", "VH009"] },
];

export const MOCK_VEHICLES = [
  { id: "VH001", image: MiniTruckSvg, name: "Tata Ace Gold", category: "Mini Truck", icon: "Truck", minWeight: 0, maxWeight: 850, supportedGoods: ["GT-002", "GT-003", "GT-011", "GT-012", "GT-015", "GT-019", "GT-020", "GT-023"], status: "active", enableDistanceCharges: true, basePrice: 150, baseDistance: 3, distancePrice: 15, serviceTax: 5, commissionType: "Percentage", commissionValue: 10, description: "Standard mini truck for city logistics" },
  { id: "VH002", image: PickupSvg, name: "Mahindra Pickup", category: "Pickup", icon: "Truck", minWeight: 500, maxWeight: 1200, supportedGoods: ["GT-003", "GT-009", "GT-012", "GT-015", "GT-017", "GT-025"], status: "active", enableDistanceCharges: true, basePrice: 250, baseDistance: 5, distancePrice: 20, serviceTax: 5, commissionType: "Percentage", commissionValue: 12, description: "Heavy duty pickup for large goods" },
  { id: "VH003", image: BikeSvg, name: "Hero Splendor", category: "Bike", icon: "Bike", minWeight: 0, maxWeight: 20, supportedGoods: ["GT-001", "GT-004", "GT-005", "GT-006", "GT-007", "GT-013", "GT-016", "GT-018"], status: "active", enableDistanceCharges: true, basePrice: 40, baseDistance: 2, distancePrice: 8, serviceTax: 5, commissionType: "Percentage", commissionValue: 15, description: "Fast delivery bike" },
  { id: "VH004", image: EvLoaderSvg, name: "Euler HiLoad", category: "Tempo", icon: "Truck", minWeight: 0, maxWeight: 688, supportedGoods: ["GT-002", "GT-011", "GT-019"], status: "active", enableDistanceCharges: true, basePrice: 120, baseDistance: 3, distancePrice: 12, serviceTax: 5, commissionType: "Fixed", commissionValue: 50, description: "Eco-friendly loader" },
  { id: "VH005", image: TempoSvg, name: "Piaggio Ape", category: "Tempo", icon: "Truck", minWeight: 0, maxWeight: 500, supportedGoods: ["GT-005", "GT-011"], status: "inactive", enableDistanceCharges: true, basePrice: 100, baseDistance: 3, distancePrice: 10, serviceTax: 5, commissionType: "Percentage", commissionValue: 10, description: "Three wheeler tempo" },
  { id: "VH006", image: VanSvg, name: "Maruti Eeco", category: "Van", icon: "Car", minWeight: 0, maxWeight: 400, supportedGoods: ["GT-002", "GT-008", "GT-011", "GT-014", "GT-019", "GT-020", "GT-021", "GT-022", "GT-023"], status: "active", enableDistanceCharges: true, basePrice: 180, baseDistance: 5, distancePrice: 14, serviceTax: 5, commissionType: "Percentage", commissionValue: 15, description: "Closed van for safe transport" },
  { id: "VH007", image: BikeSvg, name: "Honda Activa", category: "Scooter", icon: "Bike", minWeight: 0, maxWeight: 15, supportedGoods: ["GT-001", "GT-005", "GT-013", "GT-016", "GT-018"], status: "active", enableDistanceCharges: true, basePrice: 35, baseDistance: 2, distancePrice: 7, serviceTax: 5, commissionType: "Percentage", commissionValue: 12, description: "Scooter for quick parcel delivery" },
  { id: "VH008", image: PickupSvg, name: "Ashok Leyland Dost", category: "Truck", icon: "Truck", minWeight: 800, maxWeight: 2500, supportedGoods: ["GT-009", "GT-017", "GT-025"], status: "active", enableDistanceCharges: true, basePrice: 450, baseDistance: 8, distancePrice: 32, serviceTax: 5, commissionType: "Percentage", commissionValue: 8, description: "Heavy truck for industrial cargo" },
  { id: "VH009", image: TempoSvg, name: "Force Traveller", category: "Bus", icon: "Bus", minWeight: 0, maxWeight: 1500, supportedGoods: ["GT-003", "GT-011", "GT-020"], status: "active", enableDistanceCharges: true, basePrice: 600, baseDistance: 10, distancePrice: 28, serviceTax: 5, commissionType: "Fixed", commissionValue: 120, description: "Mini bus for bulk passenger goods" },
];

export const MOCK_DASHBOARD_KPIS = {
  totalOrders: { value: "1,248", trend: "up", trendValue: "+12%", description: "Compared to yesterday" },
  activeDrivers: { value: "142", trend: "up", trendValue: "+5", description: "Currently online" },
  activeVehicles: { value: "108", trend: "up", trendValue: "+3", description: "On the move" },
  ordersInTransit: { value: "48", trend: "up", trendValue: "+10%", description: "Live tracking" },
  completedOrders: { value: "1,180", trend: "up", trendValue: "+15%", description: "Successfully delivered" },
  pendingOrders: { value: "12", trend: "down", trendValue: "-2%", description: "Waiting for driver" },
  cancelledOrders: { value: "8", trend: "down", trendValue: "-1%", description: "Customer/Driver cancelled" },
  revenueToday: { value: "₹45,200", trend: "up", trendValue: "+8%", description: "Total earnings" },
  avgDeliveryTime: { value: "32 min", trend: "down", trendValue: "-3 min", description: "Average completion time" },
  customerRating: { value: "4.8", trend: "up", trendValue: "+0.1", description: "Average rating" },
  pendingIssues: { value: "3", trend: "down", trendValue: "-2", description: "Requires admin action" },
  fleetUtilization: { value: "85%", trend: "up", trendValue: "+5%", description: "Active vs Total fleet" }
};

export const MOCK_CHART_DAILY_ORDERS = [
  { name: '08:00', orders: 40 },
  { name: '10:00', orders: 120 },
  { name: '12:00', orders: 250 },
  { name: '14:00', orders: 210 },
  { name: '16:00', orders: 180 },
  { name: '18:00', orders: 300 },
  { name: '20:00', orders: 280 },
];

export const MOCK_CHART_REVENUE = [
  { name: 'Mon', revenue: 45000 },
  { name: 'Tue', revenue: 52000 },
  { name: 'Wed', revenue: 61000 },
  { name: 'Thu', revenue: 48000 },
  { name: 'Fri', revenue: 75000 },
  { name: 'Sat', revenue: 90000 },
  { name: 'Sun', revenue: 68000 },
];

export const MOCK_CHART_VEHICLE_UTILIZATION = [
  { name: 'Bike', active: 85, idle: 15 },
  { name: 'Mini Truck', active: 60, idle: 40 },
  { name: 'Pickup', active: 75, idle: 25 },
  { name: 'EV Loader', active: 90, idle: 10 },
];

export const MOCK_RECENT_ORDERS = [
  { id: "ORD-901", customer: "John Doe", pickup: "Andheri East", drop: "Bandra West", driver: "Ravi Kumar", vehicle: "Mini Truck", goodsType: "Electronics", distance: "12 km", amount: "₹450", payment: "Prepaid", status: "in_transit", time: "10 min ago" },
  { id: "ORD-902", customer: "Alice Smith", pickup: "Juhu", drop: "Colaba", driver: "Amit Singh", vehicle: "Bike", goodsType: "Documents", distance: "25 km", amount: "₹250", payment: "Cash", status: "pending", time: "15 min ago" },
  { id: "ORD-903", customer: "Bob Johnson", pickup: "Powai", drop: "Goregaon", driver: "Suresh", vehicle: "Pickup", goodsType: "Furniture", distance: "8 km", amount: "₹800", payment: "Wallet", status: "delivered", time: "1 hour ago" },
  { id: "ORD-904", customer: "Charlie Brown", pickup: "Borivali", drop: "Malad", driver: "Vikas", vehicle: "Three Wheeler", goodsType: "Groceries", distance: "5 km", amount: "₹250", payment: "Prepaid", status: "in_transit", time: "2 hours ago" },
  { id: "ORD-905", customer: "Eve Davis", pickup: "Thane", drop: "Mulund", driver: "Karan", vehicle: "Mini Truck", goodsType: "Hardware", distance: "6 km", amount: "₹350", payment: "Prepaid", status: "delivered", time: "3 hours ago" },
  { id: "ORD-906", customer: "Frank White", pickup: "Dadar", drop: "Worli", driver: "Unassigned", vehicle: "Bike", goodsType: "Food", distance: "4 km", amount: "₹120", payment: "Cash", status: "pending", time: "4 hours ago" },
  { id: "ORD-907", customer: "Grace Lee", pickup: "Vashi", drop: "Nerul", driver: "Rahul", vehicle: "EV Loader", goodsType: "Parcels", distance: "10 km", amount: "₹400", payment: "Wallet", status: "in_transit", time: "5 hours ago" },
  { id: "ORD-908", customer: "Hank Green", pickup: "Chembur", drop: "Sion", driver: "Raj", vehicle: "Tempo", goodsType: "FMCG", distance: "7 km", amount: "₹600", payment: "Prepaid", status: "delivered", time: "6 hours ago" },
  { id: "ORD-909", customer: "Ivy Taylor", pickup: "Kalyan", drop: "Dombivli", driver: "Sunil", vehicle: "Van", goodsType: "Textiles", distance: "8 km", amount: "₹500", payment: "Prepaid", status: "cancelled", time: "7 hours ago" },
  { id: "ORD-910", customer: "Jack Wilson", pickup: "Mira Road", drop: "Bhayandar", driver: "Deepak", vehicle: "Pickup", goodsType: "Machinery", distance: "5 km", amount: "₹900", payment: "Cash", status: "delivered", time: "8 hours ago" },
];

export const MOCK_RECENT_DRIVERS = [
  { id: "DRV-101", image: DriverSvg, name: "Ravi Kumar", phone: "+91 9876543210", vehicle: "Mini Truck", rating: "4.8", completedOrders: 145, status: "active" },
  { id: "DRV-102", image: DriverSvg, name: "Amit Singh", phone: "+91 8765432109", vehicle: "Bike", rating: "4.5", completedOrders: 89, status: "offline" },
  { id: "DRV-103", image: DriverSvg, name: "Suresh", phone: "+91 7654321098", vehicle: "Pickup", rating: "4.9", completedOrders: 210, status: "active" },
  { id: "DRV-104", image: DriverSvg, name: "Vikas", phone: "+91 6543210987", vehicle: "Three Wheeler", rating: "4.7", completedOrders: 112, status: "active" },
  { id: "DRV-105", image: DriverSvg, name: "Karan", phone: "+91 5432109876", vehicle: "Mini Truck", rating: "4.6", completedOrders: 75, status: "offline" },
  { id: "DRV-106", image: DriverSvg, name: "Rahul", phone: "+91 4321098765", vehicle: "EV Loader", rating: "4.9", completedOrders: 320, status: "active" },
  { id: "DRV-107", image: DriverSvg, name: "Raj", phone: "+91 3210987654", vehicle: "Tempo", rating: "4.4", completedOrders: 45, status: "active" },
  { id: "DRV-108", image: DriverSvg, name: "Sunil", phone: "+91 2109876543", vehicle: "Van", rating: "4.8", completedOrders: 180, status: "offline" },
];

export const MOCK_TOP_VEHICLES = [
  { name: "Tata Ace Gold", image: MiniTruckSvg, orders: 1250, availability: "85%" },
  { name: "Hero Splendor", image: BikeSvg, orders: 3400, availability: "92%" },
  { name: "Mahindra Pickup", image: PickupSvg, orders: 890, availability: "78%" },
  { name: "Piaggio Ape", image: TempoSvg, orders: 650, availability: "65%" }
];

export const MOCK_NOTIFICATIONS = [
  { id: 1, title: "Driver Assigned", message: "Ravi Kumar assigned to ORD-901", time: "10 mins ago", type: "success" },
  { id: 2, title: "Order Delayed", message: "ORD-902 is delayed by 15 mins due to traffic", time: "30 mins ago", type: "warning" },
  { id: 3, title: "Vehicle Offline", message: "MH01AB1234 went offline unexpectedly", time: "1 hour ago", type: "error" },
  { id: 4, title: "Pricing Updated", message: "Surge pricing applied in Bandra zone", time: "2 hours ago", type: "info" },
];
