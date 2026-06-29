/**
 * WeatherHeatmap — pulls from Open-Meteo (free, no API key required)
 * and renders a Leaflet map with live weather alerts and information across India.
 */
import React, { useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseReady } from '../../utils/supabase';
import { notify } from '../Notification';

const CITIES = [
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { name: 'Bhopal', lat: 23.2599, lng: 77.4126 },
  { name: 'Patna', lat: 25.5941, lng: 85.1376 },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  { name: 'Guwahati', lat: 26.1158, lng: 91.7086 },
  { name: 'Bhubaneswar', lat: 20.2961, lng: 85.8245 },
  { name: 'Trivandrum', lat: 8.5241, lng: 76.9366 },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { name: 'Indore', lat: 22.7196, lng: 75.8577 },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  { name: 'Srinagar', lat: 34.0837, lng: 74.7973 },
  { name: 'Dehradun', lat: 30.3165, lng: 78.0322 },
  { name: 'Ranchi', lat: 23.3441, lng: 85.3096 },
  { name: 'Raipur', lat: 21.2514, lng: 81.6296 }
];

const lats = CITIES.map(c => c.lat).join(',');
const lngs = CITIES.map(c => c.lng).join(',');
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,apparent_temperature&forecast_days=1`;

const WMO_CODES = {
  0:'☀️ Clear sky', 1:'🌤️ Mainly clear', 2:'⛅ Partly cloudy', 3:'☁️ Overcast',
  45:'🌫️ Fog', 51:'🌦️ Light drizzle', 61:'🌧️ Slight rain', 71:'❄️ Slight snow',
  80:'🌧️ Rain showers', 95:'⛈️ Thunderstorm',
};

const getIconForCode = (code) => {
  if ([95,96,99].includes(code)) return '⛈️';
  if ([61,63,65,80,81,82].includes(code)) return '🌧️';
  if ([51,53,55].includes(code)) return '🌦️';
  if ([1,2,3].includes(code)) return '⛅';
  if ([45,48].includes(code)) return '🌫️';
  return '☀️';
};

export default function WeatherHeatmap({ height = 440, showPanel = true }) {
  const mapRef    = useRef(null);
  const mapInst   = useRef(null);
  const markersRef = useRef([]);
  const [wxData, setWxData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch weather
  useEffect(() => {
    fetch(WEATHER_URL)
      .then(r => r.json())
      .then(dataList => {
        const array = Array.isArray(dataList) ? dataList : [dataList];
        const formatted = array.map((data, index) => {
          const c = data.current;
          const cityInfo = CITIES[index];
          return {
            name: cityInfo.name,
            lat: cityInfo.lat,
            lng: cityInfo.lng,
            temp: c.temperature_2m,
            feels: c.apparent_temperature,
            humidity: c.relative_humidity_2m,
            wind: c.wind_speed_10m,
            precip: c.precipitation,
            code: c.weather_code,
            label: WMO_CODES[c.weather_code] || '🌡️ Unknown',
          };
        });

        setWxData(formatted);

        // Calculate summary statistics
        const rainCities = formatted.filter(city => [61,63,65,80,81,82,95,96,99].includes(city.code));
        const highestTempCity = formatted.reduce((prev, current) => (prev.temp > current.temp) ? prev : current);
        const lowestTempCity = formatted.reduce((prev, current) => (prev.temp < current.temp) ? prev : current);
        const avgHumidity = Math.round(formatted.reduce((sum, city) => sum + city.humidity, 0) / formatted.length);

        setSummary({
          totalCities: formatted.length,
          rainCount: rainCities.length,
          highest: `${highestTempCity.name} (${highestTempCity.temp}°C)`,
          lowest: `${lowestTempCity.name} (${lowestTempCity.temp}°C)`,
          humidity: `${avgHumidity}%`
        });

        // Weather alerts trigger for severe rain/storms in major regions
        const alertCities = formatted.filter(city => [61,63,65,80,81,82,95,96,99].includes(city.code));
        if (alertCities.length > 0) {
          const citiesStr = alertCities.slice(0, 3).map(c => c.name).join(', ') + (alertCities.length > 3 ? ` and ${alertCities.length - 3} more` : '');
          notify(`⛈️ Active Weather Alert: Precipitation / Storms reported in: ${citiesStr}`, 'weather');
          
          if (isSupabaseReady) {
            supabase.from('notifications').insert(
              alertCities.map(city => ({
                title: 'Weather Warning',
                message: `Precipitation (${city.label}) reported in ${city.name} area.`,
                type: 'warning',
              }))
            ).then(() => {});
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching India weather:", err);
        setLoading(false);
      });
  }, []);

  // Init and update Leaflet map
  useEffect(() => {
    if (!mapRef.current) return;
    const L = window.L;
    if (!L) return;

    if (!mapInst.current) {
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
        .setView([22.5937, 78.9629], 5); // Geographic center of India

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18,
      }).addTo(map);

      mapInst.current = map;
    }

    const map = mapInst.current;

    // Clear existing markers if any
    if (markersRef.current) {
      markersRef.current.forEach(m => m.remove());
    }
    markersRef.current = [];

    // Add markers for all cities
    if (wxData) {
      wxData.forEach(city => {
        const iconChar = getIconForCode(city.code);
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:36px;height:36px;background:rgba(53,199,255,.18);border:2px solid ${[95,96,99].includes(city.code) ? 'rgba(255,107,26,.6)' : 'rgba(53,199,255,.5)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;backdrop-filter:blur(8px);cursor:pointer;box-shadow:0 0 10px rgba(0,0,0,0.5)">${iconChar}</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        });

        const popupHtml = `
          <div style="color: #fff; background: #0c1020; padding: 10px; border-radius: 8px; font-family: sans-serif; font-size: 12px; border: 1px solid rgba(129,160,218,.2); min-width: 140px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; border-bottom: 1px solid rgba(129,160,218,.15); padding-bottom: 4px; color: #a78bff;">${city.name}</div>
            <div style="margin: 3px 0;"><b>Condition:</b> ${city.label}</div>
            <div style="margin: 3px 0;"><b>Temp:</b> ${city.temp}°C (Feels ${city.feels}°C)</div>
            <div style="margin: 3px 0;"><b>Humidity:</b> ${city.humidity}%</div>
            <div style="margin: 3px 0;"><b>Wind:</b> ${city.wind} km/h</div>
            <div style="margin: 3px 0;"><b>Precipitation:</b> ${city.precip} mm</div>
          </div>
        `;

        const marker = L.marker([city.lat, city.lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml, { closeButton: false, minWidth: 160 });

        markersRef.current.push(marker);
      });
    }
  }, [wxData]);

  const wxBg = hasPrecip => {
    return hasPrecip ? 'rgba(53,199,255,.1)' : 'rgba(0,230,118,.08)';
  };

  return (
    <div>
      {/* Weather info panel */}
      {showPanel && !loading && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Cities Monitored', val: `${summary.totalCities} Cities`, icon: '📊', precip: false },
            { label: 'Active Rain/Storms', val: `${summary.rainCount} Regions`, icon: '🌧️', precip: summary.rainCount > 0 },
            { label: 'Highest Temp', val: summary.highest, icon: '🔥', precip: false },
            { label: 'Lowest Temp', val: summary.lowest, icon: '❄️', precip: false },
          ].map(r => (
            <div key={r.label} style={{ background: wxBg(r.precip), border: '1px solid rgba(129,160,218,.15)', borderRadius: 8, padding: '10px 12px' }}>
              <div className="eyebrow mb-1">{r.icon} {r.label}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.val}</div>
            </div>
          ))}
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: '10px', fontSize: 12, color: 'var(--muted)' }}>⛅ Loading national weather data…</div>}

      {/* Map */}
      <div ref={mapRef} style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }} />
      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
        WEATHER DATA · NATIONAL COVERAGE · VIA OPEN-METEO.COM · UPDATES EVERY 15 MIN
      </div>
    </div>
  );
}
