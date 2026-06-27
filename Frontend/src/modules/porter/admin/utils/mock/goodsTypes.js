export const GOODS_CATEGORIES = [
  "Documents",
  "Electronics",
  "Furniture",
  "Perishables",
  "Industrial",
  "Fragile",
  "Medical",
  "General",
];

export const MOCK_GOODS_TYPES = [
  { id: "GT-001", name: "Documents", icon: "FileText", description: "Envelopes, contracts, legal papers and office documents.", category: "Documents", maxWeightKg: 5, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 1 },
  { id: "GT-002", name: "Electronics", icon: "Smartphone", description: "Mobile phones, laptops, accessories and small gadgets.", category: "Electronics", maxWeightKg: 25, fragileAllowed: true, temperatureControlled: false, status: "active", displayOrder: 2 },
  { id: "GT-003", name: "Furniture", icon: "Sofa", description: "Chairs, tables, wardrobes and assembled furniture items.", category: "Furniture", maxWeightKg: 500, fragileAllowed: true, temperatureControlled: false, status: "active", displayOrder: 3 },
  { id: "GT-004", name: "Medicines", icon: "Pill", description: "Pharmaceutical products requiring careful handling.", category: "Medical", maxWeightKg: 15, fragileAllowed: true, temperatureControlled: true, status: "active", displayOrder: 4 },
  { id: "GT-005", name: "Groceries", icon: "ShoppingBasket", description: "Daily essentials, packaged foods and household items.", category: "Perishables", maxWeightKg: 40, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 5 },
  { id: "GT-006", name: "Food", icon: "UtensilsCrossed", description: "Prepared meals, bakery items and restaurant deliveries.", category: "Perishables", maxWeightKg: 20, fragileAllowed: true, temperatureControlled: true, status: "active", displayOrder: 6 },
  { id: "GT-007", name: "Flowers", icon: "Flower2", description: "Fresh bouquets and floral arrangements.", category: "Perishables", maxWeightKg: 8, fragileAllowed: true, temperatureControlled: true, status: "active", displayOrder: 7 },
  { id: "GT-008", name: "Fragile Items", icon: "PackageOpen", description: "Glassware, ceramics, mirrors and delicate goods.", category: "Fragile", maxWeightKg: 50, fragileAllowed: true, temperatureControlled: false, status: "active", displayOrder: 8 },
  { id: "GT-009", name: "Industrial Parts", icon: "Cog", description: "Machine components, spare parts and factory supplies.", category: "Industrial", maxWeightKg: 200, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 9 },
  { id: "GT-010", name: "Heavy Machinery", icon: "Truck", description: "Large equipment requiring specialized vehicles.", category: "Industrial", maxWeightKg: 2000, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 10 },
  { id: "GT-011", name: "Textiles", icon: "Shirt", description: "Garments, fabrics and fashion merchandise.", category: "General", maxWeightKg: 30, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 11 },
  { id: "GT-012", name: "Hardware", icon: "Wrench", description: "Tools, fittings, plumbing and construction hardware.", category: "Industrial", maxWeightKg: 100, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 12 },
  { id: "GT-013", name: "Parcels", icon: "Package", description: "Standard e-commerce and courier parcels.", category: "General", maxWeightKg: 35, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 13 },
  { id: "GT-014", name: "Chemicals", icon: "FlaskConical", description: "Non-hazardous industrial chemicals in sealed containers.", category: "Industrial", maxWeightKg: 80, fragileAllowed: true, temperatureControlled: false, status: "inactive", displayOrder: 14 },
  { id: "GT-015", name: "Appliances", icon: "Refrigerator", description: "Home appliances including TVs, fridges and washing machines.", category: "Electronics", maxWeightKg: 120, fragileAllowed: true, temperatureControlled: false, status: "active", displayOrder: 15 },
  { id: "GT-016", name: "Books & Stationery", icon: "BookOpen", description: "Books, notebooks and office stationery supplies.", category: "General", maxWeightKg: 25, fragileAllowed: false, temperatureControlled: false, status: "active", displayOrder: 16 },
];
