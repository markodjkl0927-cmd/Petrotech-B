/**
 * Geocoding service to convert addresses to coordinates
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * For production, consider using Google Maps Geocoding API for better accuracy
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

type ReverseGeocodeResult = {
  displayName: string;
  shortLabel: string;
};

const reverseCache = new Map<
  string,
  {
    expiresAt: number;
    value: ReverseGeocodeResult | null;
  }
>();

const REVERSE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function buildShortLabel(address: any): string {
  const road = address?.road || address?.pedestrian || address?.footway || address?.path;
  const suburb = address?.suburb || address?.neighbourhood;
  const city = address?.city || address?.town || address?.village || address?.hamlet;
  const state = address?.state;
  const country = address?.country;

  const parts = [road, suburb, city, state, country].filter(Boolean);
  return parts.join(', ') || '';
}

/**
 * Geocode an address to get latitude and longitude
 * @param street - Street address
 * @param city - City name
 * @param state - State (optional)
 * @param zipCode - ZIP code
 * @param country - Country code (default: US)
 * @returns Coordinates or null if geocoding fails
 */
export async function geocodeAddress(
  street: string,
  city: string,
  state?: string,
  zipCode?: string,
  country: string = 'US'
): Promise<GeocodingResult | null> {
  try {
    // Build address string
    const addressParts = [street, city];
    if (state) addressParts.push(state);
    if (zipCode) addressParts.push(zipCode);
    if (country) addressParts.push(country);
    
    const addressString = addressParts.join(', ');

    // Use OpenStreetMap Nominatim API (free, no API key required)
    // Note: For production, consider using Google Maps Geocoding API for better accuracy
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Petrotech-Fuel-Delivery/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      console.error('Geocoding API error:', response.statusText);
      return null;
    }

    const data = await response.json() as Array<{ lat: string; lon: string }>;

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('No geocoding results found for address:', addressString);
      return null;
    }

    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates into a human-readable place label (MVP).
 * Uses OpenStreetMap Nominatim reverse endpoint.
 *
 * NOTE: Do not call this on every poll tick; cache or throttle callers.
 */
export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  try {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    // Cache by ~11m precision to reduce external calls
    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = reverseCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(latitude)
    )}&lon=${encodeURIComponent(String(longitude))}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Petrotech-Fuel-Delivery/1.0', // Required by Nominatim
        'Accept-Language': 'en', // Prefer readable English labels
      },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      reverseCache.set(key, { expiresAt: now + REVERSE_CACHE_TTL_MS, value: null });
      return null;
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      reverseCache.set(key, { expiresAt: now + REVERSE_CACHE_TTL_MS, value: null });
      return null;
    }
    const displayName = String(data?.display_name || '').trim();
    const shortLabel = buildShortLabel(data?.address);

    const value: ReverseGeocodeResult | null = displayName
      ? { displayName, shortLabel: shortLabel || displayName }
      : null;

    reverseCache.set(key, { expiresAt: now + REVERSE_CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Alternative: Use Google Maps Geocoding API (requires API key)
 * Uncomment and use this if you have a Google Maps API key
 */
/*
export async function geocodeAddressGoogle(
  street: string,
  city: string,
  state?: string,
  zipCode?: string,
  country: string = 'US'
): Promise<GeocodingResult | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not configured');
      return null;
    }

    const addressParts = [street, city];
    if (state) addressParts.push(state);
    if (zipCode) addressParts.push(zipCode);
    if (country) addressParts.push(country);
    
    const addressString = addressParts.join(', ');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('Google Geocoding API error:', data.status);
      return null;
    }

    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  } catch (error) {
    console.error('Google Geocoding error:', error);
    return null;
  }
}
*/
