/**
 * Geocoding service to convert addresses to coordinates
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * For production, consider using Google Maps Geocoding API for better accuracy
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
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
