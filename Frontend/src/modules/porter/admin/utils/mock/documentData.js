import DriverSvg from "@/assets/mock/vehicles/driver1.svg";
import { MOCK_DRIVERS } from "./drivers";
import { MOCK_DOC_PREVIEW } from "./mockImages";

const vehicles = ["Mini Truck", "Bike", "Pickup", "Three Wheeler", "EV Loader", "Tempo", "Van"];
const statuses = ["pending", "approved", "rejected", "expired"];

function makeDoc(i) {
  const driver = MOCK_DRIVERS[i % MOCK_DRIVERS.length];
  const status = statuses[i % statuses.length];
  const expiry = new Date(2026, 6 + (i % 12), 15);
  if (status === "expired") expiry.setMonth(expiry.getMonth() - 4);
  return {
    id: `DOC-${String(6001 + i)}`,
    driverId: driver.id,
    driverName: driver.name,
    avatar: driver.photo || DriverSvg,
    vehicle: vehicles[i % vehicles.length],
    vehicleNumber: `MH${String(1 + (i % 9)).padStart(2, "0")}AB${String(1000 + i)}`,
    license: status === "rejected" ? "Rejected copy" : `DL-${String(2020 + (i % 5))}-${String(10000 + i)}`,
    insurance: `INS/BLZ/${String(8800 + i)}`,
    rc: `RC/MH/${String(440000 + i)}`,
    identityProof: i % 2 === 0 ? "Aadhaar" : "PAN Card",
    expiryDate: expiry.toISOString(),
    verificationStatus: status,
    previewUrl: MOCK_DOC_PREVIEW,
    previewType: i % 3 === 0 ? "pdf" : "image",
    submittedAt: new Date(2026, 4, 1 + (i % 28)).toISOString(),
  };
}

export const MOCK_DOCUMENTS = Array.from({ length: 30 }, (_, i) => makeDoc(i + 1));

export const DOC_STATUSES = statuses;
