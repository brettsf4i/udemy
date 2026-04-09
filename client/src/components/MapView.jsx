import { useState, useRef, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { MapPin, X, Search, Loader2 } from 'lucide-react';
import L from 'leaflet';

function calcDimensions(bbox) {
  if (!bbox) return null;
  const latKm = Math.abs(bbox.north - bbox.south) * 111;
  const lngKm =
    Math.abs(bbox.east - bbox.west) *
    111 *
    Math.cos(((bbox.south + bbox.north) / 2) * (Math.PI / 180));
  return { latKm: latKm.toFixed(1), lngKm: lngKm.toFixed(1) };
}

export default function MapView() {
  const { state, dispatch } = useProject();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const rectangleRef = useRef(null);
  const drawStartRef = useRef(null);
  const bboxRef = useRef(state.bbox); // mirror bbox in a ref so drawing handlers stay stable
  const dispatchRef = useRef(dispatch);
  const [isDrawing, setIsDrawing] = useState(false);

  // Keep refs in sync without re-running effects
  useEffect(() => { bboxRef.current = state.bbox; }, [state.bbox]);
  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [40.7128, -74.006],
      zoom: 13,
      zoomControl: false,
      dragging: true,
      boxZoom: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Dark-themed OpenStreetMap tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Leaflet reads the container size at init time. In a flex layout inside
    // React StrictMode the container may report wrong dimensions on first paint.
    // Firing a synthetic resize event is the most reliable way to make Leaflet
    // recalculate — it listens to window resize internally.
    const fixSize = () => {
      if (!mapInstanceRef.current) return;
      map.invalidateSize({ animate: false, pan: false });
      window.dispatchEvent(new Event('resize'));
    };
    setTimeout(fixSize, 0);
    setTimeout(fixSize, 150);
    setTimeout(fixSize, 500);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Bbox drawing handlers — registered ONCE, read live state via refs
  useEffect(() => {
    // Wait for map to be ready (it initializes in a separate effect)
    const waitForMap = setInterval(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      clearInterval(waitForMap);

      const onMouseDown = (e) => {
        if (bboxRef.current) return; // Already have a selection
        drawStartRef.current = e.latlng;
        setIsDrawing(true);
        map.dragging.disable();
        if (rectangleRef.current) {
          rectangleRef.current.remove();
          rectangleRef.current = null;
        }
      };

      const onMouseMove = (e) => {
        if (!drawStartRef.current) return;
        const bounds = L.latLngBounds(drawStartRef.current, e.latlng);
        if (rectangleRef.current) {
          rectangleRef.current.setBounds(bounds);
        } else {
          rectangleRef.current = L.rectangle(bounds, {
            color: '#4F6EF7',
            weight: 2,
            opacity: 0.8,
            fillColor: '#4F6EF7',
            fillOpacity: 0.1,
            dashArray: '6 4',
          }).addTo(map);
        }
      };

      const onMouseUp = (e) => {
        if (!drawStartRef.current) return;
        map.dragging.enable();
        setIsDrawing(false);

        const start = drawStartRef.current;
        drawStartRef.current = null;

        const bounds = L.latLngBounds(start, e.latlng);
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        if (Math.abs(ne.lat - sw.lat) < 0.001 || Math.abs(ne.lng - sw.lng) < 0.001) {
          if (rectangleRef.current) { rectangleRef.current.remove(); rectangleRef.current = null; }
          return;
        }

        if (rectangleRef.current) {
          rectangleRef.current.setStyle({ dashArray: null, fillOpacity: 0.15, opacity: 1 });
        }

        const bbox = { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
        dispatchRef.current({ type: 'SET_BBOX', payload: bbox });
        dispatchRef.current({ type: 'SET_STEP', payload: 2 });
      };

      map.on('mousedown', onMouseDown);
      map.on('mousemove', onMouseMove);
      map.on('mouseup', onMouseUp);
    }, 50);

    return () => clearInterval(waitForMap);
  }, []); // empty deps — handlers read state via refs, never re-register

  // Nominatim city search (free, no key)
  const searchCity = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSuggestions(
        data.map((item) => ({
          name: item.display_name.split(',').slice(0, 2).join(','),
          fullName: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          bbox: item.boundingbox, // [south, north, west, east] as strings
        }))
      );
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (value) => {
    setSearchQuery(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchCity(value), 300);
  };

  const selectCity = (city) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([city.lat, city.lon], 14);
    dispatch({ type: 'SET_CITY_NAME', payload: city.name.split(',')[0].trim() });
    dispatch({ type: 'SET_STEP', payload: 1 });
    setSuggestions([]);
    setSearchQuery(city.name);
  };

  const clearSelection = () => {
    if (rectangleRef.current) {
      rectangleRef.current.remove();
      rectangleRef.current = null;
    }
    dispatch({ type: 'SET_BBOX', payload: null });
    dispatch({ type: 'SET_STEP', payload: 1 });
  };

  const dims = calcDimensions(state.bbox);

  return (
    <div className={`relative w-full h-full ${!state.bbox && !isDrawing ? 'cursor-crosshair' : ''}`}>
      <div
        ref={mapRef}
        className="w-full h-full"
      />

      {/* Search bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="relative max-w-md">
          {searching ? (
            <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary animate-spin" />
          ) : (
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search for a city..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface/95 backdrop-blur border border-border rounded-lg text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-primary"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
              {suggestions.map((city, i) => (
                <button
                  key={i}
                  onClick={() => selectCity(city)}
                  className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors border-b border-border last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-primary flex-shrink-0" />
                    <span className="text-sm text-primary truncate">{city.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instruction overlay */}
      {!state.bbox && !isDrawing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2.5 bg-surface/95 backdrop-blur border border-border rounded-lg">
          <p className="text-sm text-secondary">Click and drag to select your area</p>
        </div>
      )}

      {/* Bbox dimensions badge */}
      {state.bbox && dims && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-4 py-2 bg-surface/95 backdrop-blur border border-border rounded-lg">
          <span className="text-sm text-primary font-medium">
            {dims.lngKm} km × {dims.latKm} km
          </span>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 text-xs text-error hover:text-error/80 transition-colors"
          >
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {state.isLoading && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-5 py-3 bg-surface border border-border rounded-lg">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-primary">{state.loadingMessage || 'Loading...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
