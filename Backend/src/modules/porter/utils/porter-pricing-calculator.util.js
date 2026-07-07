/**
 * Shared Porter fare calculation — used by quote preview and order pricing.
 */
export function calculateFareFromPricing(pricing, distanceKm) {
    if (!pricing) return null;

    const basePrice = Number(pricing.basePrice || 0);
    const baseDistance = Number(pricing.baseDistance || 0);
    const distancePrice = Number(pricing.distancePrice || 0);
    const serviceTaxPct = Number(pricing.serviceTax || 0);
    const commissionType = pricing.commissionType || 'Percentage';
    const commissionValue = Number(pricing.commissionValue || 0);

    let fare = basePrice;
    if (pricing.enableDistanceCharges !== false) {
        const extraKm = Math.max(0, distanceKm - baseDistance);
        fare += extraKm * distancePrice;
    }

    const tax = (fare * serviceTaxPct) / 100;
    
    let commission = 0;
    if (commissionType === 'Fixed') {
        commission = commissionValue;
    } else {
        commission = (fare * commissionValue) / 100;
    }
    
    const driverEarning = Math.max(0, Math.round(fare - commission));
    const platformFee = Math.round(commission);
    const subtotal = fare + tax;

    return {
        baseFare: Math.round(fare),
        distanceCharge: Math.round(Math.max(0, distanceKm - baseDistance) * distancePrice),
        serviceTax: Math.round(tax),
        commission: Math.round(commission),
        total: Math.round(subtotal),
        driverEarning,
    };
}
