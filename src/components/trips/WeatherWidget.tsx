'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
}

interface DayForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
}

interface WeatherData {
  location: string;
  forecasts: DayForecast[];
}

interface WeatherWidgetProps {
  destination: string;
  startDate: string;
  endDate: string;
}

// ─── Weather code → emoji mapping ───────────────────

function weatherEmoji(code: number): string {
  if (code === 0) return '\u2600\uFE0F'; // clear
  if (code >= 1 && code <= 3) return '\U0001F324\uFE0F'; // partly cloudy
  if (code >= 45 && code <= 48) return '\u2601\uFE0F'; // fog/overcast
  if (code >= 51 && code <= 67) return '\U0001F327\uFE0F'; // rain/drizzle
  if (code >= 71 && code <= 77) return '\u2744\uFE0F'; // snow
  if (code >= 80 && code <= 82) return '\U0001F327\uFE0F'; // showers
  if (code >= 95 && code <= 99) return '\u26C8\uFE0F'; // thunderstorm
  return '\u2601\uFE0F'; // default cloud
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Despejado';
  if (code >= 1 && code <= 3) return 'Parcialmente nublado';
  if (code >= 45 && code <= 48) return 'Niebla';
  if (code >= 51 && code <= 55) return 'Llovizna';
  if (code >= 56 && code <= 67) return 'Lluvia';
  if (code >= 71 && code <= 77) return 'Nieve';
  if (code >= 80 && code <= 82) return 'Chubascos';
  if (code >= 95 && code <= 99) return 'Tormenta';
  return 'Nublado';
}

// ─── Session storage cache helpers ──────────────────

const CACHE_PREFIX = 'gustrips-weather-';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key: string): WeatherData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: WeatherData; ts: number };
    if (Date.now() - parsed.ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: WeatherData): void {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

// ─── Component ──────────────────────────────────────

export default function WeatherWidget({ destination, startDate, endDate }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!destination) {
      setLoading(false);
      setError(true);
      return;
    }

    const cacheKey = `${destination}-${startDate}-${endDate}`;
    const cached = getCached(cacheKey);
    if (cached) {
      setWeather(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchWeather = async () => {
      try {
        // Step 1: Geocode the destination — extract first city name
        let city = destination;
        // Take first part before comma, slash, or "y"
        city = city.split(',')[0].split('/')[0].split(' y ')[0].split(' Y ')[0].trim();
        // Remove parentheses and extra words
        city = city.replace(/[()]/g, '').trim();
        // If still too long, take first word only
        if (city.split(' ').length > 3) city = city.split(' ').slice(0, 2).join(' ');

        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) throw new Error('Geocoding failed');
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
          throw new Error('Location not found');
        }

        const geo: GeoResult = {
          latitude: geoData.results[0].latitude,
          longitude: geoData.results[0].longitude,
          name: geoData.results[0].name,
        };

        // Step 2: Fetch weather forecast — limit to max 16 days from today
        const today = new Date();
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 15);
        const maxDateStr = maxDate.toISOString().split('T')[0];

        // Clamp dates to available range
        const effectiveStart = startDate > maxDateStr ? null : startDate < today.toISOString().split('T')[0] ? today.toISOString().split('T')[0] : startDate;
        const effectiveEnd = endDate > maxDateStr ? maxDateStr : endDate;

        if (!effectiveStart || effectiveStart > effectiveEnd) {
          // Trip dates entirely outside forecast range
          if (!cancelled) { setLoading(false); }
          return;
        }

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${effectiveStart}&end_date=${effectiveEnd}`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
          // Weather API may fail for dates too far in the future (max 16 days)
          setLoading(false);
          return;
        }
        const weatherJson = await weatherRes.json();

        if (!weatherJson.daily || !weatherJson.daily.time) {
          throw new Error('No weather data');
        }

        const forecasts: DayForecast[] = weatherJson.daily.time.map(
          (date: string, i: number) => ({
            date,
            tempMax: Math.round(weatherJson.daily.temperature_2m_max[i]),
            tempMin: Math.round(weatherJson.daily.temperature_2m_min[i]),
            weatherCode: weatherJson.daily.weathercode[i],
          }),
        );

        // Limit to first 7 days for a compact display
        const result: WeatherData = {
          location: geo.name,
          forecasts: forecasts.slice(0, 7),
        };

        if (!cancelled) {
          setWeather(result);
          setCache(cacheKey, result);
          setLoading(false);
        }
      } catch (err) {
        console.error('WeatherWidget error:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchWeather();

    return () => {
      cancelled = true;
    };
  }, [destination, startDate, endDate]);

  // Don't render anything if there's an error (keeps the layout clean)
  if (error) return null;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-sky-400">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
          <span className="text-gray-400 text-sm">Cargando clima...</span>
        </div>
      </div>
    );
  }

  if (!weather || weather.forecasts.length === 0) return null;

  // Compute averages for the header summary
  const avgMax = Math.round(
    weather.forecasts.reduce((s, f) => s + f.tempMax, 0) / weather.forecasts.length,
  );
  const avgMin = Math.round(
    weather.forecasts.reduce((s, f) => s + f.tempMin, 0) / weather.forecasts.length,
  );
  const mainCode = weather.forecasts[0].weatherCode;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.18 }}
      className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-sky-400 hover:shadow-lg transition-shadow"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-xl">
            {weatherEmoji(mainCode)}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Clima</p>
            <p className="text-gray-900 text-sm font-semibold">{weather.location}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-900 text-lg font-bold leading-none">{avgMax}°</p>
          <p className="text-gray-400 text-xs">{avgMin}° min</p>
        </div>
      </div>

      {/* Daily forecast row */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
        {weather.forecasts.map((day) => {
          const dayName = new Date(day.date + 'T12:00:00').toLocaleDateString('es', {
            weekday: 'short',
          });
          return (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1 min-w-[52px] py-2 px-1.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-400 text-[10px] font-medium capitalize">{dayName}</span>
              <span className="text-base">{weatherEmoji(day.weatherCode)}</span>
              <span className="text-gray-900 text-xs font-semibold">{day.tempMax}°</span>
              <span className="text-gray-300 text-[10px]">{day.tempMin}°</span>
            </div>
          );
        })}
      </div>

      {/* Caption */}
      <p className="text-gray-300 text-[10px] mt-2 text-right">
        {weatherLabel(mainCode)} · Open-Meteo
      </p>
    </motion.div>
  );
}
