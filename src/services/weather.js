import * as Location from 'expo-location';

const CODES = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'violent showers',
  85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm',
  96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

/**
 * Live local forecast from Open-Meteo. No API key required.
 * Returns null if the user declines location — callers fall back to manual entry.
 */
export async function getWeather() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const pos = await Location.getLastKnownPositionAsync()
    ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  if (!pos) return null;

  const { latitude, longitude } = pos.coords;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}` +
    `&longitude=${longitude.toFixed(3)}` +
    `&current=temperature_2m,apparent_temperature,precipitation,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&forecast_days=2&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast unavailable');
  const d = await res.json();

  return {
    temp: Math.round(d.current.temperature_2m),
    feelsLike: Math.round(d.current.apparent_temperature),
    high: Math.round(d.daily.temperature_2m_max[0]),
    low: Math.round(d.daily.temperature_2m_min[0]),
    rainChance: d.daily.precipitation_probability_max?.[0] ?? 0,
    sky: CODES[d.current.weather_code] || 'clear',
    unit: d.current_units?.temperature_2m || '°C',
  };
}

export function describeWeather(w) {
  if (!w) return 'weather unknown';
  return `${w.temp}${w.unit}, feels ${w.feelsLike}${w.unit}, ${w.sky}, high ${w.high} / low ${w.low}, ${w.rainChance}% chance of rain`;
}

/** Forecast for a destination and date range — used by the packing list. */
export async function getTripForecast(lat, lon, startDate, endDate) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast unavailable');
  const d = await res.json();
  const highs = d.daily.temperature_2m_max;
  const lows = d.daily.temperature_2m_min;
  return {
    days: highs.length,
    high: Math.max(...highs),
    low: Math.min(...lows),
    wetDays: (d.daily.precipitation_probability_max || []).filter((p) => p >= 50).length,
  };
}

/** Geocode a place name to coordinates (Open-Meteo geocoding, keyless). */
export async function geocode(place) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`
  );
  if (!res.ok) return null;
  const d = await res.json();
  const hit = d.results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude, label: `${hit.name}, ${hit.country_code}` } : null;
}
