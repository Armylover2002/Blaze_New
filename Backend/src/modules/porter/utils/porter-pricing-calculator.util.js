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
    
    const roundedFare = Math.round(fare);
    const roundedTax = Math.round(tax);
    const roundedCommission = Math.round(commission);
    const driverEarning = Math.max(0, roundedFare - roundedCommission);
    const subtotal = roundedFare + roundedTax;

    return {
        baseFare: roundedFare,
        distanceCharge: Math.round(Math.max(0, distanceKm - baseDistance) * distancePrice),
        serviceTax: roundedTax,
        commission: roundedCommission,
        total: subtotal,
        driverEarning,
    };
}
