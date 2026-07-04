import React, { useEffect, useRef, useState } from 'react';
import { getAccurateCoords, reverseGeocode, forwardGeocode } from '../../utils/gps';

export default function GPSPickerMap({ lat, lng, onChange }) {
  const mapContainerRef = useRef(null);
  const mapInst = useRef(null);
  const markerInst = useRef(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Initialise Map
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const L = window.L;
    if (!L || !mapContainerRef.current || mapInst.current) return;

    const initialLat = lat || 18.5204;
    const initialLng = lng || 73.8567;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([initialLat, initialLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: `<div style="position:relative;width:24px;height:24px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#35c7ff;border:2px solid #fff;box-shadow:0 0 10px rgba(53,199,255,.6);z-index:2"></div>
          <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #35c7ff;opacity:0;animation:ring-expand 2s ease-out infinite"></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    }).addTo(map);

    // Marker drag end handler
    marker.on('dragend', async () => {
      const position = marker.getLatLng();
      setLoading(true);
      const res = await reverseGeocode(position.lat, position.lng);
      onChange(position.lat, position.lng, res.address);
      setLoading(false);
    });

    // Map click handler
    map.on('click', async (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      marker.setLatLng([clickLat, clickLng]);
      map.panTo([clickLat, clickLng]);
      setLoading(true);
      const res = await reverseGeocode(clickLat, clickLng);
      onChange(clickLat, clickLng, res.address);
      setLoading(false);
    });

    mapInst.current = map;
    markerInst.current = marker;

    return () => {
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
        markerInst.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state lat/lng updates into map marker position
  useEffect(() => {
    if (mapInst.current && markerInst.current && lat && lng) {
      const markerLatLng = markerInst.current.getLatLng();
      if (markerLatLng.lat !== lat || markerLatLng.lng !== lng) {
        markerInst.current.setLatLng([lat, lng]);
        mapInst.current.setView([lat, lng]);
      }
    }
  }, [lat, lng]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);
    setError('');
    const result = await forwardGeocode(search);
    if (result) {
      const { lat: newLat, lng: newLng, display_name } = result;
      if (mapInst.current && markerInst.current) {
        markerInst.current.setLatLng([newLat, newLng]);
        mapInst.current.setView([newLat, newLng], 15);
      }
      onChange(newLat, newLng, display_name);
    } else {
      setError('Location not found. Try searching a city, landmark, or PIN code.');
    }
    setLoading(false);
  };

  const handleLocateMe = async () => {
    setLoading(true);
    setError('');
    const coords = await getAccurateCoords();
    if (coords) {
      const { lat: newLat, lng: newLng } = coords;
      if (mapInst.current && markerInst.current) {
        markerInst.current.setLatLng([newLat, newLng]);
        mapInst.current.setView([newLat, newLng], 15);
      }
      const res = await reverseGeocode(newLat, newLng);
      onChange(newLat, newLng, res.address);
    } else {
      setError('Could not access GPS. Please check browser permissions.');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 10 }}>
      {/* Search Input & Locate Button */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search location (e.g. Pune Station, Kothrud)..."
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'rgba(53,199,255,.15)',
            border: '1px solid rgba(53,199,255,.3)',
            color: 'var(--blue)',
            borderRadius: 8,
            padding: '0 12px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {loading ? '...' : 'FIND'}
        </button>
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={loading}
          style={{
            background: 'rgba(37,230,163,.15)',
            border: '1px solid rgba(37,230,163,.3)',
            color: 'var(--safe)',
            borderRadius: 8,
            padding: '0 12px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          📍 LOCATE ME
        </button>
      </form>

      {error && (
        <div style={{ color: '#ff8a95', fontSize: 10, marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{
          height: 180,
          borderRadius: 8,
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}
      />

      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>💡 Click map or drag marker to reposition pin exactly</span>
        <span>{lat?.toFixed(5)}, {lng?.toFixed(5)}</span>
      </div>
    </div>
  );
}
