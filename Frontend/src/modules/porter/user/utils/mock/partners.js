export const MOCK_PARTNERS = [
  {
    id: "DP-101",
    name: "Rahul Sharma",
    phone: "+91 98765 43210",
    rating: 4.9,
    trips: 2840,
    vehicle: "Auto Rickshaw",
    vehicleNumber: "UP 16 AB 4521",
    photo: null,
    pickupOtp: "4829",
  },
  {
    id: "DP-102",
    name: "Vikram Singh",
    phone: "+91 91234 56789",
    rating: 4.8,
    trips: 1560,
    vehicle: "Mini Truck",
    vehicleNumber: "DL 1C AB 7890",
    photo: null,
    pickupOtp: "7153",
  },
  {
    id: "DP-103",
    name: "Amit Patel",
    phone: "+91 99887 76655",
    rating: 4.7,
    trips: 920,
    vehicle: "Bike",
    vehicleNumber: "MH 02 CD 3344",
    photo: null,
    pickupOtp: "2936",
  },
  {
    id: "DP-104",
    name: "Suresh Kumar",
    phone: "+91 87654 32109",
    rating: 4.85,
    trips: 3100,
    vehicle: "EV Van",
    vehicleNumber: "KA 05 EF 1122",
    photo: null,
    pickupOtp: "6041",
  },
];

export function getRandomPartner() {
  return MOCK_PARTNERS[Math.floor(Math.random() * MOCK_PARTNERS.length)];
}
