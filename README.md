# LaserMap Studio

Convert OpenStreetMap data into precisely registered 3-layer SVG files optimized for laser engraving wooden city maps.

## What It Does

LaserMap Studio generates a set of three SVG files that, when laser-cut and stacked, create a professional multi-layer wooden city map:

- **Layer 1 (Top)** — Major road corridors cut completely through wood, creating raised city block islands
- **Layer 2 (Middle)** — Minor/residential roads engraved as surface grooves on a solid panel
- **Layer 3 (Bottom)** — Land silhouette with water bodies cut through, revealing colored acrylic beneath

All three layers include registration marks for precise alignment using 3mm dowel pins.

## Prerequisites

- **Node.js 18+**
- **Google Maps API key** (for map display and city search)

### Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Places API**
4. Create an API key under Credentials
5. Copy the key for use in the `.env` file below

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd lasermapstudio

# Install all dependencies (root, client, and server)
npm run install:all

# Configure environment variables
cp client/.env.example client/.env
cp server/.env.example server/.env

# Edit client/.env and add your Google Maps API key
# VITE_GOOGLE_MAPS_API_KEY=your_actual_key_here
```

## Running in Development

```bash
# Start both client and server concurrently
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/api/health

## How to Use

1. **Search** — Type a city name in the search bar to navigate the map
2. **Select Area** — Click and drag on the map to draw a bounding box over your area of interest
3. **Generate** — Click "Generate Preview" to fetch OpenStreetMap data and see a 3-layer preview
4. **Customize** — Adjust output size, material thickness, kerf compensation, road density, and text labels
5. **Export** — Click "Download LaserMap Files" to get a ZIP with all SVG files and assembly instructions

## Troubleshooting

### Empty map data
The selected area may have limited OpenStreetMap coverage. Try selecting a more urban area or a larger bounding box.

### Google Maps API key errors
Ensure your API key has the Maps JavaScript API and Places API enabled. Check that the key has no IP/referrer restrictions blocking localhost.

### Overpass API timeouts
The OpenStreetMap Overpass API can be busy during peak hours. The app retries once automatically. If it persists, wait a minute and try again.

### Misaligned layers
All layers use a single shared D3 projection instance to guarantee alignment. If layers appear offset, regenerate the preview — this resets the projection.

### Export failures
Large or highly detailed selections may take longer to process. If export times out, try reducing the road density slider or selecting a smaller area.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, D3-geo, Google Maps JS API
- **Backend**: Node.js, Express, Overpass API, clipper-lib, archiver
- **Map Data**: OpenStreetMap (free, no API key needed)

## License

MIT
