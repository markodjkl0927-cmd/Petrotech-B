/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Company location: Franconia-Springfield, Virginia, USA
 * Using approximate coordinates for the area (can be updated with exact P.O. Box location if needed)
 * Franconia-Springfield is approximately at: 38.7821° N, 77.1753° W
 */
export const COMPANY_LOCATION = {
  latitude: 38.7821,
  longitude: -77.1753,
  address: 'P.O.Box 10037, Franconia-Springfield, Virginia, USA',
};

/**
 * Calculate delivery fee based on distance
 * - $1.25 per mile for 1-3 miles
 * - $0.95 per mile for 3+ miles
 */
export function calculateDeliveryFee(distanceInMiles: number): number {
  if (distanceInMiles <= 0) {
    return 0;
  }

  if (distanceInMiles <= 3) {
    return Math.round(distanceInMiles * 1.25 * 100) / 100;
  } else {
    // First 3 miles at $1.25, remaining miles at $0.95
    const firstThreeMiles = 3 * 1.25;
    const remainingMiles = (distanceInMiles - 3) * 0.95;
    return Math.round((firstThreeMiles + remainingMiles) * 100) / 100;
  }
}

/**
 * Calculate company markup (0.095% of fuel cost)
 */
export function calculateCompanyMarkup(fuelCost: number): number {
  return Math.round(fuelCost * 0.00095 * 100) / 100;
}

/**
 * Calculate tax (simplified - can be enhanced with state-specific rates)
 * Using approximate 6% tax rate (can be made configurable per state)
 */
export function calculateTax(subtotal: number, state?: string): number {
  // Default tax rate (can be enhanced with state-specific rates)
  const taxRate = 0.06; // 6%
  return Math.round(subtotal * taxRate * 100) / 100;
}
