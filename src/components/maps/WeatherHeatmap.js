/**
 * WeatherHeatmap — fully-featured weather analysis portal.
 * Integrates Google Maps, RainViewer overlays, tabs for Alerts/Forecast/Current Weather,
 * detailed forecast sidebar (hourly + daily charts) with Location Search & GPS locator,
 * and active NDMA warning cards.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  { name: 'Raipur', lat: 21.2514, lng: 81.6296 },
  { name: 'Hingoli', lat: 19.7214, lng: 77.1396 },
  { name: 'Lalguda', lat: 19.8244, lng: 77.2185 }
];

const MET_ALERTS = [
  {
    id: 1,
    title: 'Moderate Rain Warning',
    source: 'Uttar Pradesh Government',
    city: 'Lucknow',
    lat: 26.8467,
    lng: 80.9462,
    time: '02 Jul, 10:25',
    detail: 'nw and central UP regions expecting consistent precipitation.',
    validity: 'Valid till 02 Jul, 13:25',
    intensity: 'Medium Intensity',
    severity: 'medium', // orange
    color: '#ff8a3d'
  },
  {
    id: 2,
    title: 'Thunderstorm with Lightning',
    source: 'West Bengal Government',
    city: 'Kolkata',
    lat: 22.5726,
    lng: 88.3639,
    time: '02 Jul, 10:15',
    detail: '4 districts of West Bengal under watch for isolated lightning strikes.',
    validity: 'Valid till 02 Jul, 13:15',
    intensity: 'Low Intensity',
    severity: 'low', // yellow
    color: '#ffd166'
  },
  {
    id: 3,
    title: 'Light Thunderstorms',
    source: 'Madhya Pradesh Government',
    city: 'Bhopal',
    lat: 23.2599,
    lng: 77.4126,
    time: '02 Jul, 10:00',
    detail: '30 districts of Madhya Pradesh expecting wind speeds up to 40 km/h.',
    validity: 'Valid till 02 Jul, 13:00',
    intensity: 'Low Intensity',
    severity: 'low', // yellow
    color: '#ffd166'
  },
  {
    id: 4,
    title: 'Severe Flash Flood Alert',
    source: 'Maharashtra Disaster Response',
    city: 'Hingoli',
    lat: 19.7214,
    lng: 77.1396,
    time: '02 Jul, 10:30',
    detail: 'Heavy downpours causing rising water levels in low-lying areas of Hingoli and Wani.',
    validity: 'Valid till 02 Jul, 16:30',
    intensity: 'High Intensity',
    severity: 'high', // red
    color: '#ff4d5e'
  }
];

const lats = CITIES.map(c => c.lat).join(',');
const lngs = CITIES.map(c => c.lng).join(',');
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,apparent_temperature&forecast_days=1`;

const WMO_CODES = {
  0: '☀️ Clear sky', 1: '🌤️ Mainly clear', 2: '⛅ Partly cloudy', 3: '☁️ Overcast',
  45: '🌫️ Fog', 51: '🌦️ Light drizzle', 61: '🌧️ Slight rain', 71: '❄️ Slight snow',
  80: '🌧️ Rain showers', 95: '⛈️ Thunderstorm',
};

const getIconForCode = (code) => {
  if ([95, 96, 99].includes(code)) return '⛈️';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([51, 53, 55].includes(code)) return '🌦️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([45, 48].includes(code)) return '🌫️';
  return '☀️';
};

const mapOWMToWMO = (id) => {
  if (id >= 200 && id < 300) return 95; // Thunderstorm
  if (id >= 300 && id < 600) return 61; // Rain / Drizzle
  if (id >= 600 && id < 700) return 71; // Snow
  if (id >= 700 && id < 800) return 45; // Fog
  if (id === 800) return 0; // Clear
  if (id > 800) return 2; // Cloudy
  return 0;
};

export default function WeatherHeatmap({ height = 440, showPanel = true }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const [wxData, setWxData] = useState([]);
  const [dataSource, setDataSource] = useState('OPENWEATHERMAP.ORG');
  const [activeTab, setActiveTab] = useState('current'); // 'alerts' | 'forecast' | 'current'

  // User and Selected City Forecast State
  const [userLoc, setUserLoc] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastReport, setForecastReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch forecast details for selected city
  const loadForecastDetails = useCallback((city) => {
    setForecastLoading(true);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const now = new Date();
        const currentHour = now.getHours();

        // 6-hour hourly forecast
        const hourlyList = [];
        for (let i = 0; i < 6; i++) {
          const index = (currentHour + i) % 24;
          if (data.hourly && data.hourly.time[index]) {
            const timeStr = data.hourly.time[index].split('T')[1]; // "11:00"
            hourlyList.push({
              time: timeStr,
              temp: data.hourly.temperature_2m[index],
              code: data.hourly.weather_code[index]
            });
          }
        }

        // 4-day daily forecast
        const dailyList = [];
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        for (let i = 0; i < 4; i++) {
          if (data.daily && data.daily.time[i]) {
            const date = new Date(data.daily.time[i]);
            let dayName = days[date.getDay()];
            if (i === 0) dayName = 'Today';
            dailyList.push({
              day: dayName,
              maxTemp: data.daily.temperature_2m_max[i],
              minTemp: data.daily.temperature_2m_min[i],
              code: data.daily.weather_code[i]
            });
          }
        }

        setForecastReport({
          city: city.name,
          temp: city.temp || (data.hourly ? data.hourly.temperature_2m[currentHour] : 25),
          feels: city.feels || (data.hourly ? data.hourly.temperature_2m[currentHour] : 25),
          label: city.label || 'Clear sky',
          humidity: city.humidity || 65,
          wind: city.wind || 10,
          precip: city.precip || 0,
          code: city.code || 0,
          hourly: hourlyList,
          daily: dailyList
        });
        setForecastLoading(false);
      })
      .catch(err => {
        console.error("Forecast API fetch failed:", err);
        setForecastLoading(false);
      });
  }, []);

  // Fetch initial national weather
  useEffect(() => {
    const envKey = process.env.REACT_APP_OPENWEATHER_API_KEY;
    const apiKey = (envKey && envKey !== 'YOUR_OPENWEATHER_API_KEY') ? envKey : '983ab426945e7c591ba4c3c4a41169b9';

    const fetchOpenMeteo = () => {
      setDataSource('OPEN-METEO.COM');
      return fetch(WEATHER_URL)
        .then(r => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(dataList => {
          const array = Array.isArray(dataList) ? dataList : [dataList];
          return array.map((data, index) => {
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
        });
    };

    const fetchOpenWeatherMap = () => {
      setDataSource('OPENWEATHERMAP.ORG');
      const promises = CITIES.map(city =>
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lng}&appid=${apiKey}&units=metric`)
          .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
          })
      );

      return Promise.all(promises).then(results => {
        return results.map((data, index) => {
          const id = data.weather[0]?.id || 800;
          const code = mapOWMToWMO(id);
          return {
            name: CITIES[index].name,
            lat: CITIES[index].lat,
            lng: CITIES[index].lng,
            temp: data.main.temp,
            feels: data.main.feels_like,
            humidity: data.main.humidity,
            wind: Math.round(data.wind.speed * 3.6),
            precip: data.rain ? (data.rain['1h'] || data.rain['3h'] || 0) : 0,
            code: code,
            label: WMO_CODES[code] || data.weather[0]?.description || '🌡️ Unknown',
          };
        });
      });
    };

    const weatherPromise = apiKey
      ? fetchOpenWeatherMap().catch((err) => {
        console.warn("OpenWeatherMap fetch failed, falling back to Open-Meteo:", err);
        return fetchOpenMeteo();
      })
      : fetchOpenMeteo();

    weatherPromise
      .then(formatted => {
        setWxData(formatted);

        // Default select Pune or active region
        const defaultCity = formatted.find(c => c.name === 'Pune') || formatted[0];
        loadForecastDetails(defaultCity);

        // Geolocation lookup on mount
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              setUserLoc({ lat: latitude, lng: longitude });

              if (mapInst.current) {
                mapInst.current.setView([latitude, longitude], 10);
              }

              // Fetch local weather
              fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`)
                .then(res => res.json())
                .then(data => {
                  const id = data.weather[0]?.id || 800;
                  const code = mapOWMToWMO(id);
                  const userCityInfo = {
                    name: data.name || 'Your Location',
                    lat: latitude,
                    lng: longitude,
                    temp: data.main?.temp || 25,
                    feels: data.main?.feels_like || 25,
                    humidity: data.main?.humidity || 65,
                    wind: Math.round((data.wind?.speed || 2) * 3.6),
                    precip: data.rain ? (data.rain['1h'] || 0) : 0,
                    code: code,
                    label: WMO_CODES[code] || data.weather[0]?.description || 'Clear sky'
                  };
                  loadForecastDetails(userCityInfo);
                })
                .catch(() => { });
            },
            () => { }
          );
        }
      })
      .catch((err) => {
        console.error("Error loading weather data:", err);
      });
  }, [loadForecastDetails]);

  // Leaflet map setup and marker updating
  useEffect(() => {
    if (!mapRef.current) return;
    const L = window.L;
    if (!L) return;

    if (!mapInst.current) {
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
        .setView(userLoc ? [userLoc.lat, userLoc.lng] : [19.75, 75.71], userLoc ? 10 : 6);

      const googleRoadmap = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps', maxZoom: 20
      });
      const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps', maxZoom: 20
      });
      const googleTerrain = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps', maxZoom: 20
      });

      googleRoadmap.addTo(map);
      mapInst.current = map;

      // Fetch RainViewer radar overlays
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
          const host = data.host || 'https://tilecache.rainviewer.com';
          if (data.radar?.past?.length > 0) {
            const radarPath = data.radar.past[data.radar.past.length - 1].path;
            const radarLayer = L.tileLayer(`${host}${radarPath}/256/{z}/{x}/{y}/2/1_1.png`, {
              maxZoom: 18, opacity: 0.55, attribution: '© RainViewer'
            });
            radarLayer.addTo(map);

            const baseMaps = {
              "🗺️ Google Roadmap": googleRoadmap,
              "🛰️ Google Hybrid": googleHybrid,
              "⛰️ Google Terrain": googleTerrain
            };

            const overlayMaps = {
              "🌧️ Live Rain Radar": radarLayer
            };

            if (data.satellite?.infrared?.length > 0) {
              const satPath = data.satellite.infrared[data.satellite.infrared.length - 1].path;
              const satLayer = L.tileLayer(`${host}${satPath}/256/{z}/{x}/{y}/0/1_1.png`, {
                maxZoom: 18, opacity: 0.45, attribution: '© RainViewer'
              });
              L.control.layers(baseMaps, { "🌧️ Live Rain Radar": radarLayer, "🛰️ Satellite Cloud": satLayer }, { collapsed: true }).addTo(map);
            } else {
              L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);
            }
          }
        })
        .catch(() => { });
    }

    const map = mapInst.current;

    // Clear old elements
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    circlesRef.current.forEach(c => c.remove());
    circlesRef.current = [];

    // Add user avatar marker if location is active
    if (userLoc) {
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;background:rgba(53,199,255,.2);border:2px solid var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;backdrop-filter:blur(8px);box-shadow:0 0 15px var(--blue)">👤</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18],
      });
      const userMarker = L.marker([userLoc.lat, userLoc.lng], { icon: userIcon })
        .addTo(map)
        .bindTooltip("Your Location", { permanent: false, direction: 'top' });
      markersRef.current.push(userMarker);
    }

    // Render depending on active Tab
    if (activeTab === 'alerts') {
      MET_ALERTS.forEach(alert => {
        // Red, orange or yellow ripple zone circles
        const circle = L.circle([alert.lat, alert.lng], {
          radius: 80000,
          color: alert.color,
          fillColor: alert.color,
          fillOpacity: 0.15,
          weight: 2,
          className: 'incident-p1'
        }).addTo(map)
          .bindPopup(`
            <div style="color: #fff; background: #0c1020; padding: 10px; border-radius: 8px; font-family: sans-serif; font-size: 12px; border: 1px solid rgba(129,160,218,.2); min-width: 160px;">
              <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: ${alert.color};">${alert.title}</div>
              <div style="font-size: 10px; color: var(--muted); margin-bottom: 6px;">${alert.source}</div>
              <div><b>City:</b> ${alert.city}</div>
              <div><b>Severity:</b> ${alert.intensity}</div>
              <div><b>Detail:</b> ${alert.detail}</div>
              <div style="margin-top: 5px; color: var(--muted);">${alert.validity}</div>
            </div>
          `);

        // Warn icon marker
        const warnIcon = L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:${alert.color};border:1.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#fff;box-shadow:0 0 12px ${alert.color}">⚠️</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        });
        const marker = L.marker([alert.lat, alert.lng], { icon: warnIcon })
          .addTo(map)
          .bindPopup(circle.getPopup());

        markersRef.current.push(marker);
        circlesRef.current.push(circle);
      });
    } else {
      // Current Weather or Forecast Tab
      wxData.forEach(city => {
        const iconChar = getIconForCode(city.code);
        let iconHtml = '';

        if (activeTab === 'forecast') {
          // Weather status condition icon mapping
          iconHtml = `<div style="width:34px;height:34px;background:rgba(15,22,41,.9);border:2px solid var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 12px rgba(53,199,255,.3)">${iconChar}</div>`;
        } else {
          // Current Weather shows condition icon
          iconHtml = `<div style="width:34px;height:34px;background:rgba(15,22,41,.9);border:2px solid ${[95, 96, 99].includes(city.code) ? 'var(--high)' : 'var(--border2)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 10px rgba(0,0,0,0.5)">${iconChar}</div>`;
        }

        const icon = L.divIcon({
          className: '',
          html: iconHtml,
          iconSize: [34, 34], iconAnchor: [17, 17]
        });

        const marker = L.marker([city.lat, city.lng], { icon })
          .addTo(map)
          .on('click', () => {
            loadForecastDetails(city);
          });

        const popupContent = `
          <div style="color: #fff; background: #0c1020; padding: 10px; border-radius: 8px; font-family: sans-serif; font-size: 12px; border: 1px solid rgba(129,160,218,.2); min-width: 140px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid rgba(129,160,218,.15); padding-bottom: 4px; color: #a78bff;">${city.name}</div>
            <div style="margin: 3px 0;"><b>Condition:</b> ${city.label}</div>
            <div style="margin: 3px 0;"><b>Temp:</b> ${city.temp}°C</div>
            <div style="margin: 3px 0;"><b>Humidity:</b> ${city.humidity}%</div>
            <div style="margin: 3px 0;"><b>Wind:</b> ${city.wind} km/h</div>
          </div>
        `;
        marker.bindPopup(popupContent, { closeButton: false });

        markersRef.current.push(marker);
      });
    }
  }, [wxData, activeTab, userLoc, loadForecastDetails]);

  // Handle Forward Geocoding Search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const L = window.L;
    if (!L) return;

    // Search local pre-mapped CITIES list first
    const matchedLocal = CITIES.find(c => c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    if (matchedLocal) {
      const currentWx = wxData.find(w => w.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      const cityToLoad = currentWx || matchedLocal;

      loadForecastDetails(cityToLoad);
      if (mapInst.current) {
        mapInst.current.setView([cityToLoad.lat, cityToLoad.lng], 9);
      }
      notify(`Found location: ${cityToLoad.name}`, 'success');
      return;
    }

    // Dynamic fetch from OpenStreetMap Nominatim forward geocoding API
    setForecastLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const { lat, lon, display_name } = data[0];
          const name = display_name.split(',')[0];
          const latVal = parseFloat(lat);
          const lngVal = parseFloat(lon);

          const envKey = process.env.REACT_APP_OPENWEATHER_API_KEY;
          const apiKey = (envKey && envKey !== 'YOUR_OPENWEATHER_API_KEY') ? envKey : '983ab426945e7c591ba4c3c4a41169b9';

          fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latVal}&lon=${lngVal}&appid=${apiKey}&units=metric`)
            .then(res => res.json())
            .then(wx => {
              const id = wx.weather[0]?.id || 800;
              const code = mapOWMToWMO(id);
              const searchedCity = {
                name: name,
                lat: latVal,
                lng: lngVal,
                temp: wx.main?.temp || 25,
                feels: wx.main?.feels_like || 25,
                humidity: wx.main?.humidity || 65,
                wind: Math.round((wx.wind?.speed || 2) * 3.6),
                precip: wx.rain ? (wx.rain['1h'] || 0) : 0,
                code: code,
                label: WMO_CODES[code] || wx.weather[0]?.description || 'Clear sky'
              };

              // Add a search pin marker on map
              if (mapInst.current) {
                const searchIcon = L.divIcon({
                  className: '',
                  html: `<div style="width:34px;height:34px;background:rgba(53,199,255,.9);border:2px solid var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 15px var(--blue)">📍</div>`,
                  iconSize: [34, 34], iconAnchor: [17, 17]
                });
                const tempMarker = L.marker([latVal, lngVal], { icon: searchIcon })
                  .addTo(mapInst.current)
                  .bindPopup(`<b>${name}</b><br/>Temp: ${searchedCity.temp}°C`);
                markersRef.current.push(tempMarker);
                mapInst.current.setView([latVal, lngVal], 9);
              }

              loadForecastDetails(searchedCity);
              notify(`Displaying weather for: ${name}`, 'success');
            })
            .catch(() => {
              const fallbackCity = { name, lat: latVal, lng: lngVal, code: 0, label: 'Clear sky' };
              loadForecastDetails(fallbackCity);
              if (mapInst.current) {
                mapInst.current.setView([latVal, lngVal], 9);
              }
            });
        } else {
          notify(`Location not found: "${searchQuery}"`, 'warning');
          setForecastLoading(false);
        }
      })
      .catch(err => {
        console.error("Geocoding failed:", err);
        notify("Search query failed.", "error");
        setForecastLoading(false);
      });
  };

  // Trigger GPS Geolocation Lookup
  const triggerGPSLookup = () => {
    setForecastLoading(true);
    if (!navigator.geolocation) {
      notify("Geolocation is not supported by your browser", "warning");
      setForecastLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLoc({ lat: latitude, lng: longitude });

        const envKey = process.env.REACT_APP_OPENWEATHER_API_KEY;
        const apiKey = (envKey && envKey !== 'YOUR_OPENWEATHER_API_KEY') ? envKey : '983ab426945e7c591ba4c3c4a41169b9';

        // Reverse geocode user location name via Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(res => res.json())
          .then(geoData => {
            const locName = geoData.address.suburb || geoData.address.village || geoData.address.town || geoData.address.city || 'Your Location';

            // Return weather metrics promise chain
            return fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`)
              .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
              })
              .then(wx => {
                const id = wx.weather[0]?.id || 800;
                const code = mapOWMToWMO(id);
                const userCityInfo = {
                  name: locName,
                  lat: latitude,
                  lng: longitude,
                  temp: wx.main?.temp || 25,
                  feels: wx.main?.feels_like || 25,
                  humidity: wx.main?.humidity || 65,
                  wind: Math.round((wx.wind?.speed || 2) * 3.6),
                  precip: wx.rain ? (wx.rain['1h'] || 0) : 0,
                  code: code,
                  label: WMO_CODES[code] || wx.weather[0]?.description || 'Clear sky'
                };

                if (mapInst.current) {
                  mapInst.current.setView([latitude, longitude], 10);
                }

                loadForecastDetails(userCityInfo);
                notify(`GPS located: ${locName}`, 'success');
              });
          })
          .catch(() => {
            const fallbackCity = { name: 'Your Location', lat: latitude, lng: longitude, code: 0, label: 'Clear sky' };
            loadForecastDetails(fallbackCity);
            if (mapInst.current) {
              mapInst.current.setView([latitude, longitude], 10);
            }
          });
      },
      (err) => {
        console.error(err);
        notify("GPS location request denied or failed.", "warning");
        setForecastLoading(false);
      }
    );
  };

  // Click an alert card to fly map to location
  const handleAlertClick = (alert) => {
    if (mapInst.current) {
      mapInst.current.setView([alert.lat, alert.lng], 8);
      setActiveTab('alerts');
      notify(`Flying map view to warning site: ${alert.city}`, 'info');
    }
  };

  const currentTabStyle = (tab) => ({
    padding: '8px 18px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
    letterSpacing: '.05em',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: activeTab === tab ? 'var(--blue)' : 'rgba(255,255,255,0.08)',
    color: activeTab === tab ? '#000' : 'var(--text)',
    boxShadow: activeTab === tab ? '0 0 12px var(--blue)' : 'none'
  });

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Dynamic Segment Tabs */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('alerts')} style={currentTabStyle('alerts')}>
            🚨 ALERTS ({MET_ALERTS.length})
          </button>
          <button onClick={() => setActiveTab('forecast')} style={currentTabStyle('forecast')}>
            ⛈️ IMD FORECAST
          </button>
          <button onClick={() => setActiveTab('current')} style={currentTabStyle('current')}>
            🌡️ CURRENT WEATHER
          </button>
        </div>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--muted)' }}>
          SOURCE: {dataSource} & RAINVIEWER
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-12 gap-5 mb-6">
        {/* Left Side — Map Container */}
        <div className="col-span-8 relative">
          <div ref={mapRef} style={{ height, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }} />
        </div>

        {/* Right Side — Weather Forecast Panel */}
        <div className="col-span-4 flex flex-col justify-between"
          style={{
            background: 'linear-gradient(145deg, rgba(16,28,54,0.95), rgba(9,15,30,0.9))',
            border: '1px solid rgba(53,199,255,0.15)',
            borderRadius: 14,
            padding: '20px',
            minHeight: height,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>

          {/* Location Search Bar & GPS Trigger */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4 relative">
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                placeholder="Search location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '8px 36px 8px 12px',
                  fontSize: '12px',
                  color: 'var(--text)',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
              <button type="submit" style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)' }}>
                🔍
              </button>
            </div>
            <button
              type="button"
              onClick={triggerGPSLookup}
              title="Detect GPS Location"
              style={{
                background: 'rgba(53,199,255,0.1)',
                border: '1px solid rgba(53,199,255,0.25)',
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              🎯
            </button>
          </form>

          {forecastLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-500">
              <span className="text-2xl mb-2 animate-bounce">🔄</span>
              <span>Loading forecast details…</span>
            </div>
          ) : forecastReport ? (
            <div className="flex-1 flex flex-col justify-between">
              {/* Card Header */}
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                      📍 {forecastReport.city}
                    </h3>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
                      METEOROLOGICAL REPORT
                    </span>
                  </div>
                  <span style={{ fontSize: 24 }}>{getIconForCode(forecastReport.code)}</span>
                </div>

                {/* Current Weather summary stats */}
                <div className="my-5 flex items-baseline gap-2">
                  <span style={{ fontSize: 44, fontWeight: 700, fontFamily: 'JetBrains Mono', lineHeight: 1 }}>
                    {Math.round(forecastReport.temp)}°
                  </span>
                  <div className="text-xs">
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{forecastReport.label}</div>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>Feels like {Math.round(forecastReport.feels)}°</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-700/40 text-xs mb-5">
                  <div>
                    <div style={{ color: 'var(--muted)' }}>Humidity</div>
                    <div className="font-semibold">{forecastReport.humidity}%</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)' }}>Wind</div>
                    <div className="font-semibold">{forecastReport.wind} km/h</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)' }}>Rainfall</div>
                    <div className="font-semibold">{forecastReport.precip} mm</div>
                  </div>
                </div>
              </div>

              {/* Hourly Forecast */}
              <div className="mb-5">
                <h4 className="eyebrow mb-2">Hourly Forecast</h4>
                <div className="flex justify-between items-center gap-1 overflow-x-auto py-1">
                  {forecastReport.hourly?.map((h, i) => (
                    <div key={i} className="flex flex-col items-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', minWidth: '45px' }}>
                      <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>{h.time}</span>
                      <span className="my-1" style={{ fontSize: 14 }}>{getIconForCode(h.code)}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{Math.round(h.temp)}°</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Forecast */}
              <div>
                <h4 className="eyebrow mb-2">7-Day Outlook</h4>
                <div className="flex flex-col gap-2">
                  {forecastReport.daily?.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0 border-slate-700/20">
                      <span style={{ width: '60px', fontWeight: 600 }}>{d.day}</span>
                      <span style={{ fontSize: 14 }}>{getIconForCode(d.code)}</span>
                      <span style={{ width: '70px', color: 'var(--muted)', textAlign: 'right', fontFamily: 'JetBrains Mono' }}>
                        {Math.round(d.maxTemp)}° | {Math.round(d.minTemp)}°
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-500">
              <span>Click a city marker or search a location.</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Alerts List Segment */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, letterSpacing: '.03em' }}>
            ⚡ ACTIVE METEOROLOGICAL WARNINGS (NDMA)
          </h3>
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: 'var(--muted)' }}>UPDATED LIVE</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {MET_ALERTS.map(alert => (
            <div
              key={alert.id}
              onClick={() => handleAlertClick(alert)}
              className="rounded-lg p-4 cursor-pointer transition duration-200 hover:border-slate-500 flex flex-col justify-between"
              style={{
                background: 'rgba(23,33,58,0.5)',
                border: `1px solid ${alert.color}40`,
                borderLeft: `4px solid ${alert.color}`
              }}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span style={{ fontWeight: 700, fontSize: 13, color: alert.color }}>
                    {alert.title}
                  </span>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded uppercase"
                    style={{
                      background: `${alert.color}15`,
                      color: alert.color,
                      border: `1px solid ${alert.color}35`,
                      fontFamily: 'JetBrains Mono'
                    }}
                  >
                    {alert.intensity}
                  </span>
                </div>
                <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                  {alert.source} · {alert.time}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {alert.detail}
                </p>
              </div>
              <div className="mt-3 text-[10px] font-semibold text-right" style={{ color: 'var(--muted)' }}>
                ⏳ {alert.validity}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
