const formatCoordinateAddress = (location) => {
  if (!location) return "";
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const isPlaceholderAddressPart = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return !normalized || normalized === "NA" || normalized === "N/A";
};

export const formatDeliveryAddressText = (address = {}, fallback = "") => {
  if (!address || typeof address !== "object") {
    return String(fallback || "").trim();
  }

  const explicit = String(
    address.formattedAddress ||
      address.completeAddress ||
      address.customerAddress ||
      fallback ||
      "",
  ).trim();

  const parts = [
    address.street || address.address || address.addressLine1,
    address.additionalDetails || address.landmark,
    address.city,
    address.state,
    address.zipCode || address.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter((part) => !isPlaceholderAddressPart(part));

  const merged = [...new Set(parts)].join(", ");
  if (merged) return merged;

  if (explicit && !isPlaceholderAddressPart(explicit)) {
    return explicit
      .split(",")
      .map((part) => part.trim())
      .filter((part) => !isPlaceholderAddressPart(part))
      .join(", ");
  }

  return "";
};

export const normalizeLocationPoint = (value) => {
  if (!value || typeof value !== "object") return null;

  // Prefer explicit lat/lng (socket payload sets these correctly from GeoJSON).
  // Checking coordinates first can pick swapped [lat,lng] stored by mistake.
  const explicitLat = Number(value.lat ?? value.latitude);
  const explicitLng = Number(value.lng ?? value.longitude);
  if (Number.isFinite(explicitLat) && Number.isFinite(explicitLng)) {
    return { lat: explicitLat, lng: explicitLng };
  }

  if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    const a = Number(value.coordinates[0]);
    const b = Number(value.coordinates[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      // fall through
    } else {
      // GeoJSON is [lng, lat]. Swapped [lat, lng] is common in bad data:
      // for India, lat ≈ 8–35 and lng ≈ 68–97, so |first|<45 & |second|>45 ⇒ swapped.
      const looksSwapped = Math.abs(a) <= 45 && Math.abs(b) > 45;
      const lat = looksSwapped ? a : b;
      const lng = looksSwapped ? b : a;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }

  if (value.location && typeof value.location === "object") {
    const nested = normalizeLocationPoint(value.location);
    if (nested) return nested;
  }

  return null;
};

export const isPorterParcelTrip = (order) => {
  const moduleType = String(order?.module || order?.orderType || order?.serviceType || order?.type || "")
    .trim()
    .toLowerCase();
  return (
    moduleType === "parcel" ||
    moduleType === "porter" ||
    String(order?.documentType || "").trim() === "porter_order"
  );
};

export const mapPorterStatusToTripStatus = (porterStatus) => {
  const status = String(porterStatus || "").trim().toLowerCase();
  if (["delivered", "completed"].includes(status)) return "COMPLETED";
  if (status === "at_drop") return "REACHED_DROP";
  if (["picked_up", "in_transit"].includes(status)) return "PICKED_UP";
  if (status === "at_pickup") return "REACHED_PICKUP";
  if (["partner_accepted", "en_route_pickup", "assigned", "searching_partner"].includes(status)) {
    return "PICKING_UP";
  }
  return "PICKING_UP";
};

export const normalizePickupPoints = (order) => {
  if (isPorterParcelTrip(order)) {
    const pickupLoc = normalizeLocationPoint(
      order?.pickup || order?.pickupLocation || order?.restaurantLocation,
    );
    return [{
      id: "parcel:pickup",
      pickupType: "parcel",
      sourceId: String(order?.orderId || order?.id || order?.orderMongoId || ""),
      sourceName: order?.senderName || order?.pickup?.title || "Sender",
      address: order?.pickupAddress || order?.pickup?.address || "",
      phone: String(order?.senderPhone || order?.pickup?.phone || "").trim(),
      ...(pickupLoc ? { location: pickupLoc } : {}),
    }];
  }

  const isReturn = isReturnPickupTrip(order);
  const raw = Array.isArray(order?.pickupPoints) ? order.pickupPoints : [];
  const explicitOrderType = String(
    order?.orderType || order?.serviceType || order?.type || "",
  )
    .trim()
    .toLowerCase();
  const normalized = raw
    .map((point, index) => {
      const location = normalizeLocationPoint(point?.location);
      if (!location && !isReturn) return null;
      const pickupType = point?.pickupType === "quick" ? "quick" : "food";
      const sourceName = String(
        point?.sourceName ||
          point?.name ||
          (isReturn
            ? order?.customerName || order?.userName || "Customer"
            : pickupType === "quick"
              ? "Seller store"
              : "Restaurant"),
      ).trim();
      const address = String(
        point?.address ||
          point?.formattedAddress ||
          point?.location?.address ||
          point?.location?.formattedAddress ||
          "",
      ).trim();
      return {
        id: point?.legId || `${pickupType || "pickup"}:${point?.sourceId || index}`,
        pickupType,
        sourceId: String(point?.sourceId || ""),
        sourceName,
        address: address || order?.customerAddress || "",
        phone: String(
          point?.phone ||
            point?.contactPhone ||
            order?.customerPhone ||
            order?.userPhone ||
            "",
        ).trim(),
        location,
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  const dispatchLegLocation = normalizeLocationPoint(
    order?.dispatchLeg?.location ||
      order?.pickupLocation ||
      order?.restaurantLocation ||
      order?.restaurantId,
  );
  const dispatchLegId = String(order?.dispatchLeg?.legId || "").trim();
  if (dispatchLegLocation && dispatchLegId) {
    const pickupType = order?.dispatchLeg?.pickupType === "quick" ? "quick" : "food";
    const sourceName = String(
      order?.dispatchLeg?.sourceName ||
        (pickupType === "quick"
          ? order?.storeName || order?.sellerName || "Seller store"
          : order?.restaurantName || order?.restaurantId?.restaurantName || "Restaurant"),
    ).trim();
    const address = String(
      order?.dispatchLeg?.address ||
        order?.pickupAddress ||
        (pickupType === "quick"
          ? order?.storeAddress || order?.sellerAddress
          : order?.restaurantAddress || order?.restaurantLocation?.address) ||
        "",
    ).trim();

    return [
      {
        id: dispatchLegId,
        pickupType,
        sourceId: String(order?.dispatchLeg?.sourceId || ""),
        sourceName,
        address: address || "",
        phone: String(
          order?.dispatchLeg?.phone ||
            (pickupType === "quick"
              ? order?.storePhone || order?.sellerPhone
              : order?.restaurantPhone || order?.restaurantId?.phone) ||
            "",
        ).trim(),
        location: dispatchLegLocation,
      },
    ];
  }

  const restaurantLocation = normalizeLocationPoint(
    order?.restaurantLocation || order?.restaurantId || order?.storeLocation || order?.sellerLocation,
  );
  if (!restaurantLocation) return [];
  const fallbackPickupType = explicitOrderType === "quick" ? "quick" : "food";
  const fallbackSourceName = String(
    fallbackPickupType === "quick"
      ? order?.storeName ||
          order?.sellerName ||
          order?.seller?.shopName ||
          order?.seller?.name ||
          "Seller store"
      : order?.restaurantName || order?.restaurantId?.restaurantName || order?.restaurantId?.name || "Restaurant",
  ).trim();
  const fallbackAddress = String(
    fallbackPickupType === "quick"
      ? order?.storeAddress ||
          order?.sellerAddress ||
          order?.seller?.location?.address ||
          order?.seller?.location?.formattedAddress ||
          ""
      : order?.restaurantAddress || order?.restaurantLocation?.address || ""
  ).trim();
  const fallbackPhone = String(
    fallbackPickupType === "quick"
      ? order?.storePhone || order?.sellerPhone || order?.seller?.phone || ""
      : order?.restaurantPhone || order?.restaurantId?.phone || ""
  ).trim();

  return [
    {
      id: `${fallbackPickupType}:primary`,
      pickupType: fallbackPickupType,
      sourceId: String(
        fallbackPickupType === "quick"
          ? order?.storeId || order?.sellerId || order?.seller?._id || ""
          : order?.restaurantId?._id || order?.restaurantId || "",
      ),
      sourceName: fallbackSourceName,
      address: fallbackAddress || "",
      phone: fallbackPhone,
      location: restaurantLocation,
    },
  ];
};

export const getPrimaryPickupLocation = (order) => {
  const pickupPoints = normalizePickupPoints(order);
  return pickupPoints[0]?.location || null;
};

export const isReturnPickupTrip = (order) =>
  String(order?.tripType || "").trim() === "return_pickup" ||
  String(order?.documentType || "").trim() === "seller_return";

export const enrichPorterDeliveryOrder = (order = {}) => {
  if (!isPorterParcelTrip(order)) return order;
  const pickupLoc = normalizeLocationPoint(order.pickup || order.pickupLocation || order.restaurantLocation);
  const dropLoc = normalizeLocationPoint(order.delivery || order.dropLocation || order.customerLocation);
  const pickupDistanceKm = (() => {
    const candidates = [order.pickupDistanceKm, order.distanceKm];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return order.pickupDistanceKm ?? null;
  })();

  return {
    ...order,
    module: "parcel",
    documentType: order.documentType || "porter_order",
    orderId: order.orderId || order.id || order.orderMongoId,
    orderMongoId: order.orderMongoId || order.id || order.orderId,
    restaurantLocation: pickupLoc,
    customerLocation: dropLoc,
    pickupLocation: pickupLoc,
    dropLocation: dropLoc,
    // Keep rider→pickup separate from trip route length used for fare.
    pickupDistanceKm,
    distanceKm: pickupDistanceKm ?? order.distanceKm,
    tripDistanceKm: order.tripDistanceKm ?? order.route?.distanceKm ?? null,
    earnings: order.earnings ?? order.pricing?.driverEarning ?? 0,
    riderEarning: order.riderEarning ?? order.pricing?.driverEarning ?? order.earnings ?? 0,
    senderName: order.senderName || order.pickup?.title || order.userName || "Sender",
    senderPhone: order.senderPhone || order.pickup?.phone || order.userPhone || "",
    receiverName: order.receiverName || order.parcel?.receiverName || "Receiver",
    receiverPhone: order.receiverPhone || order.parcel?.receiverPhone || "",
    pickupAddress: order.pickupAddress || order.pickup?.address || "",
    dropAddress: order.dropAddress || order.delivery?.address || "",
    vehicleName: order.vehicleName || order.vehicle?.category || "",
    parcelWeight: order.parcel?.weightKg != null
      ? Number(order.parcel.weightKg) * Math.max(1, Number(order.parcel?.quantity || 1))
      : order.parcelWeight,
    parcelName: order.parcel?.parcelName || order.parcelName || "",
    instructions: order.parcel?.instructions || order.instructions || "",
    deliveryState: order.deliveryState,
    deliveryPhotoUrl: order.deliveryState?.deliveryPhotoUrl,
  };
};

export const enrichIncomingDeliveryOrder = (order = {}) => {
  if (isPorterParcelTrip(order)) {
    return enrichPorterDeliveryOrder({
      ...order,
      pickupPoints: normalizePickupPoints(order),
      customerLocation:
        order.customerLocation ||
        normalizeLocationPoint(order.delivery || order.dropLocation),
      customerAddress: formatDeliveryAddressText(
        order.delivery,
        order.dropAddress || order.delivery?.address || "",
      ),
    });
  }

  return enrichReturnDeliveryOrder({
    ...order,
    pickupPoints: normalizePickupPoints(order),
    customerLocation:
      order.customerLocation ||
      normalizeLocationPoint(order.deliveryAddress?.location) ||
      normalizeLocationPoint(order.deliveryAddress),
    customerAddress: formatDeliveryAddressText(
      order.deliveryAddress,
      order.customerAddress || order.customer_address || "",
    ),
  });
};

export const getReturnPickupStopLabels = () => ({
  pickupLabel: "Pickup From Customer",
  dropLabel: "Drop To Seller",
});

export const enrichReturnDeliveryOrder = (order = {}) => {
  if (!isReturnPickupTrip(order)) return order;

  const dropPoint = order?.dropPoint || null;
  return {
    ...order,
    tripType: order.tripType || "return_pickup",
    documentType: order.documentType || "seller_return",
    returnId: order.returnId || order.orderMongoId || order._id || order.id,
    customerName: order.customerName || order.userName || order.pickupPoints?.[0]?.sourceName || "Customer",
    customerPhone: order.customerPhone || order.userPhone || order.pickupPoints?.[0]?.phone || "",
    storeName: order.storeName || dropPoint?.sourceName || order.restaurantName || order.sellerName || "Seller",
    storePhone: order.storePhone || dropPoint?.phone || order.sellerPhone || order.restaurantPhone || "",
    storeAddress: order.storeAddress || dropPoint?.address || order.restaurantAddress || "",
    sellerName: order.sellerName || dropPoint?.sourceName || order.storeName || order.restaurantName || "Seller",
    sellerPhone: order.sellerPhone || dropPoint?.phone || order.storePhone || order.restaurantPhone || "",
    riderEarning:
      order.riderEarning ||
      order.earnings ||
      order.tripEarning ||
      order.walletEarning ||
      0,
    earnings:
      order.earnings ||
      order.riderEarning ||
      order.tripEarning ||
      order.walletEarning ||
      0,
    dropPoint,
  };
};

export const getReturnDropLocation = (order) => {
  const drop = order?.dropPoint;
  if (drop) {
    const location = normalizeLocationPoint(drop?.location);
    if (location) return location;
  }
  return normalizeLocationPoint(
    order?.restaurantLocation ||
      order?.restaurantId ||
      order?.storeLocation ||
      order?.sellerLocation,
  );
};

export const getDeliveryDocumentId = (order) => {
  if (isReturnPickupTrip(order)) {
    return String(order?.returnId || order?.orderMongoId || order?._id || order?.id || "");
  }
  return String(order?.orderId || order?.orderMongoId || order?._id || order?.id || "");
};

export const isMixedOrder = (order) => {
  const explicitType = String(
    order?.orderType || order?.serviceType || order?.type || "",
  )
    .trim()
    .toLowerCase();

  if (explicitType === "mixed") return true;

  const pickupPoints = normalizePickupPoints(order);
  if (pickupPoints.length <= 1) return false;

  const pickupTypes = new Set(
    pickupPoints.map((point) => String(point?.pickupType || "food").toLowerCase()),
  );

  return pickupTypes.size > 1;
};
