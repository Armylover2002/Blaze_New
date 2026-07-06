export const isApprovedVehicle = (vehicle) => {
  if (!vehicle) return false;
  if (vehicle.isDispatchEligible === true) return true;
  const status = String(vehicle.status || vehicle.verificationStatus || '').toLowerCase();
  return status === 'active' || status === 'approved';
};

export const getApprovedVehicles = (vehicles = []) =>
  (Array.isArray(vehicles) ? vehicles : []).filter(isApprovedVehicle);

export const extractPartnerFromMeResponse = (response) => {
  const root = response?.data?.data ?? response?.data ?? response ?? {};
  return root.user || root.profile || root.deliveryPartner || root;
};

export const extractVehiclePayload = (response) => {
  const root = response?.data?.data ?? response?.data ?? response ?? {};
  const vehicles = root.driverVehicles || root.vehicles || [];
  return {
    vehicles: Array.isArray(vehicles) ? vehicles : [],
    driverVehicles: Array.isArray(vehicles) ? vehicles : [],
    activeVehicleId: root.activeVehicleId ? String(root.activeVehicleId) : null,
  };
};

export const extractAvailabilityPayload = (response) => {
  const root = response?.data?.data ?? response?.data ?? response ?? {};
  return {
    availabilityStatus: root.availabilityStatus || null,
    activeVehicleId: root.activeVehicleId ? String(root.activeVehicleId) : null,
  };
};
