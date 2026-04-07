import { useState, useCallback, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { MapPin, X, AlertTriangle } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1A1D27' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1D27' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B90A7' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2E3247' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2E3247' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1A1D27' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1B4FD8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function calcDimensions(bbox) {
  if (!bbox) return null;
  const latKm = Math.abs(bbox.north - bbox.south) * 111;
  const lngKm =
    Math.abs(bbox.east - bbox.west) *
    111 *
    Math.cos(((bbox.south + bbox.north) / 2) * (Math.PI / 180));
  return { latKm: latKm.toFixed(1), lngKm: lngKm.toFixed(1) };
}

function ManualBboxInput({ onSubmit }) {
  const [values, setValues] = useState({ south: '', west: '', north: '', east: '' });

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const bbox = {
      south: parseFloat(values.south),
      west: parseFloat(values.west),
      north: parseFloat(values.north),
      east: parseFloat(values.east),
    };
    if (Object.values(bbox).some(isNaN)) return;
    onSubmit(bbox);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {['south', 'west', 'north', 'east'].map((key) => (
          <div key={key}>
            <label className="text-xs text-secondary capitalize">{key}</label>
            <input
              type="number"
              step="any"
              value={values[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={key === 'south' ? '40.70' : key === 'north' ? '40.75' : key === 'west' ? '-74.02' : '-73.97'}
              className="w-full px-2 py-1.5 bg-surface-2 border border-border rounded text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
      <button
        type="submit"
        className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded transition-colors"
      >
        Set Bounding Box
      </button>
    </form>
  );
}

function GoogleMapView() {
  const { state, dispatch } = useProject();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const rectangleRef = useRef(null);
  const autocompleteRef = useRef(null);
  const drawingRef = useRef({ isDrawing: false, startLat: 0, startLng: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [drawingMode, setDrawingMode] = useState(!state.bbox);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 13,
      styles: darkMapStyle,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
      gestureHandling: 'greedy',
    });

    mapInstanceRef.current = map;

    const input = document.getElementById('map-search-input');
    if (input) {
      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
      });
      autocomplete.bindTo('bounds', map);
      autocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) return;
        map.panTo(place.geometry.location);
        map.setZoom(14);
        dispatch({ type: 'SET_CITY_NAME', payload: place.name || '' });
        dispatch({ type: 'SET_STEP', payload: 1 });
      });
    }

    map.addListener('mousedown', (e) => {
      if (!drawingMode) return;
      drawingRef.current.isDrawing = true;
      drawingRef.current.startLat = e.latLng.lat();
      drawingRef.current.startLng = e.latLng.lng();
      map.setOptions({ draggable: false });

      if (rectangleRef.current) {
        rectangleRef.current.setMap(null);
      }
      rectangleRef.current = new window.google.maps.Rectangle({
        map,
        bounds: {
          north: e.latLng.lat(),
          south: e.latLng.lat(),
          east: e.latLng.lng(),
          west: e.latLng.lng(),
        },
        strokeColor: '#4F6EF7',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#4F6EF7',
        fillOpacity: 0.1,
        clickable: false,
        editable: false,
      });
    });

    map.addListener('mousemove', (e) => {
      if (!drawingRef.current.isDrawing || !rectangleRef.current) return;
      const { startLat, startLng } = drawingRef.current;
      const curLat = e.latLng.lat();
      const curLng = e.latLng.lng();
      rectangleRef.current.setBounds({
        north: Math.max(startLat, curLat),
        south: Math.min(startLat, curLat),
        east: Math.max(startLng, curLng),
        west: Math.min(startLng, curLng),
      });
    });

    map.addListener('mouseup', (e) => {
      if (!drawingRef.current.isDrawing) return;
      drawingRef.current.isDrawing = false;
      map.setOptions({ draggable: true });

      if (!rectangleRef.current) return;
      const bounds = rectangleRef.current.getBounds();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const bbox = {
        south: sw.lat(),
        west: sw.lng(),
        north: ne.lat(),
        east: ne.lng(),
      };

      const latSpan = Math.abs(bbox.north - bbox.south);
      const lngSpan = Math.abs(bbox.east - bbox.west);
      if (latSpan < 0.001 || lngSpan < 0.001) {
        rectangleRef.current.setMap(null);
        rectangleRef.current = null;
        return;
      }

      rectangleRef.current.setOptions({
        strokeOpacity: 1,
        fillOpacity: 0.15,
        editable: true,
      });

      rectangleRef.current.addListener('bounds_changed', () => {
        const b = rectangleRef.current.getBounds();
        const ne2 = b.getNorthEast();
        const sw2 = b.getSouthWest();
        dispatch({
          type: 'SET_BBOX',
          payload: { south: sw2.lat(), west: sw2.lng(), north: ne2.lat(), east: ne2.lng() },
        });
      });

      dispatch({ type: 'SET_BBOX', payload: bbox });
      dispatch({ type: 'SET_STEP', payload: 2 });
      setDrawingMode(false);
    });

    setIsLoaded(true);
  }, [dispatch, drawingMode]);

  useEffect(() => {
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', initMap);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);
  }, [initMap]);

  const clearSelection = () => {
    if (rectangleRef.current) {
      rectangleRef.current.setMap(null);
      rectangleRef.current = null;
    }
    dispatch({ type: 'SET_BBOX', payload: null });
    dispatch({ type: 'SET_STEP', payload: 1 });
    setDrawingMode(true);
  };

  const dims = calcDimensions(state.bbox);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        className={`w-full h-full ${drawingMode ? 'cursor-crosshair' : ''}`}
      />

      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="relative max-w-md">
          <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            id="map-search-input"
            type="text"
            placeholder="Search for a city..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface/95 backdrop-blur border border-border rounded-lg text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {!state.bbox && isLoaded && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-4 py-2.5 bg-surface/95 backdrop-blur border border-border rounded-lg">
          <p className="text-sm text-secondary">Click and drag to select your area</p>
        </div>
      )}

      {state.bbox && dims && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 bg-surface/95 backdrop-blur border border-border rounded-lg">
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

      {state.isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-5 py-3 bg-surface border border-border rounded-lg">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-primary">{state.loadingMessage || 'Loading...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FallbackMapView() {
  const { state, dispatch } = useProject();
  const dims = calcDimensions(state.bbox);

  const handleManualBbox = (bbox) => {
    dispatch({ type: 'SET_BBOX', payload: bbox });
    dispatch({ type: 'SET_STEP', payload: 2 });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-background p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertTriangle size={20} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary">Google Maps API key not configured</p>
            <p className="text-xs text-secondary mt-1">
              Add your API key to <code className="text-primary bg-surface-2 px-1 rounded">.env</code> as{' '}
              <code className="text-primary bg-surface-2 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code>
            </p>
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
          <h3 className="text-sm font-medium text-primary">Manual Coordinates</h3>
          <p className="text-xs text-secondary">Enter bounding box coordinates directly:</p>
          <ManualBboxInput onSubmit={handleManualBbox} />
        </div>

        {state.bbox && dims && (
          <div className="p-3 bg-surface border border-border rounded-lg text-center">
            <span className="text-sm text-primary font-medium">
              Selection: {dims.lngKm} km × {dims.latKm} km
            </span>
          </div>
        )}

        {state.cityName && (
          <div className="p-3 bg-surface border border-border rounded-lg">
            <label className="text-xs text-secondary">City Name</label>
            <input
              type="text"
              value={state.cityName}
              onChange={(e) => dispatch({ type: 'SET_CITY_NAME', payload: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 bg-surface-2 border border-border rounded text-sm text-primary focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapView() {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_key_here') {
    return <FallbackMapView />;
  }
  return <GoogleMapView />;
}
