import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// StrictMode is intentionally omitted — it double-invokes useEffect in dev
// which tears down and re-mounts the Leaflet map, causing tile rendering issues.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
