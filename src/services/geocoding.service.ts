type GeocodeInput = {
  address: string;
  city: string;
  state: string;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT =
  process.env.GEOCODING_USER_AGENT?.trim() ||
  'R&P Global Energies Portal/1.0 (admin@randpglobalenergies.com)';

let lastRequestAt = 0;

async function throttleNominatim() {
  const now = Date.now();
  const waitMs = Math.max(0, 1100 - (now - lastRequestAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestAt = Date.now();
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult | null> {
  const query = [input.address, input.city, input.state, 'USA'].filter(Boolean).join(', ').trim();
  if (!query) return null;

  await throttleNominatim();

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.warn('[geocoding] Nominatim request failed:', response.status, query);
    return null;
  }

  const rows = (await response.json()) as Array<{ lat: string; lon: string }>;
  const hit = rows[0];
  if (!hit) {
    console.warn('[geocoding] No result for:', query);
    return null;
  }

  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export async function geocodeFuelLocation(input: GeocodeInput): Promise<GeocodeResult | null> {
  try {
    return await geocodeAddress(input);
  } catch (error) {
    console.warn('[geocoding] Failed to geocode location:', input, error);
    return null;
  }
}
