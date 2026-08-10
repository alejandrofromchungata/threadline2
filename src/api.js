import Constants from 'expo-constants';

const BASE =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  '';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function post(path, body, { timeout = 45000 } = {}) {
  if (!BASE) throw new ApiError('No API base URL configured. Set extra.apiBaseUrl in app.json.', 0);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('The server took too long to answer.', 408);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cut a garment out of its photo background.
 * @param {string} base64 raw base64 JPEG (no data: prefix)
 * @returns {{ pngBase64: string }}
 */
export const cutout = (base64) => post('/v1/cutout', { image: base64 }, { timeout: 60000 });

/**
 * Read a garment photo and infer its catalogue fields.
 * @returns {{ name, category, color, colorName, material, seasons, formality, tags }}
 */
export const tagPhoto = (base64) => post('/v1/tag-photo', { image: base64 });

/**
 * Resolve a retailer URL into product details (title, brand, price, image).
 */
export const readProduct = (url) => post('/v1/product', { url });

/**
 * Turn loose product text into catalogue fields.
 */
export const tagProduct = (payload) => post('/v1/tag-product', payload);

/**
 * Identify a piece from a description, brand and optional design photo.
 * Searches the web for the real product.
 * @returns {{ matches: Array }}
 */
export const findProduct = (payload) => post('/v1/find', payload, { timeout: 90000 });

/**
 * Build an outfit from the closet.
 * @returns {{ name, itemIds, why, missing }}
 */
export const buildOutfit = (payload) => post('/v1/outfit', payload);

/**
 * Wardrobe gap analysis.
 * @returns {{ gaps: [{ gap, why }] }}
 */
export const findGaps = (payload) => post('/v1/gaps', payload);

/**
 * Packing list for a trip.
 * @returns {{ itemIds, notes, buy }}
 */
export const packList = (payload) => post('/v1/pack', payload);

export { ApiError, BASE as API_BASE };
