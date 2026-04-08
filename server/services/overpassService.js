const axios = require('axios');

// Primary + mirror Overpass endpoints — tried in order until one succeeds
const OVERPASS_ENDPOINTS = (process.env.OVERPASS_API_URL
  ? [process.env.OVERPASS_API_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ]
);

// Axios timeout per request attempt
const OVERPASS_TIMEOUT = parseInt(process.env.OVERPASS_TIMEOUT_MS, 10) || 60000;

/**
 * Execute an Overpass QL query, trying each endpoint in turn.
 * Moves to the next mirror on 429, 504, or connection timeout.
 */
async function queryOverpass(qlQuery) {
  let lastErr = null;

  for (const url of OVERPASS_ENDPOINTS) {
    try {
      console.log(`[Overpass] Trying ${url}`);
      const response = await axios.post(
        url,
        `data=${encodeURIComponent(qlQuery)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: OVERPASS_TIMEOUT,
        }
      );
      console.log(`[Overpass] Success from ${url}`);
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      const isRetriable =
        err.code === 'ECONNABORTED' || status === 429 || status === 504 || status === 503;

      console.warn(`[Overpass] ${url} failed: ${status || err.code || err.message}`);
      lastErr = err;

      if (!isRetriable) break; // Hard error — no point trying mirrors
      // Otherwise fall through to next endpoint
    }
  }

  // All endpoints failed
  const msg = lastErr?.response
    ? `Overpass API unavailable (${lastErr.response.status}). Try again in a moment.`
    : `Overpass connection failed: ${lastErr?.message}`;
  const err = new Error(msg);
  err.statusCode = 502;
  err.expose = true;
  throw err;
}

/**
 * Fetch road data within bbox.
 */
async function fetchRoads(bbox) {
  const { south, west, north, east } = bbox;
  const query = `[out:json][timeout:55];
(
  way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service"]
  (${south},${west},${north},${east});
);
out geom;`;

  console.log(`[Overpass] Fetching roads for bbox: ${south},${west},${north},${east}`);
  const data = await queryOverpass(query);
  console.log(`[Overpass] Roads: ${data.elements?.length ?? 0} elements`);
  return data.elements || [];
}

/**
 * Fetch water features within bbox.
 */
async function fetchWater(bbox) {
  const { south, west, north, east } = bbox;
  const query = `[out:json][timeout:55];
(
  way["natural"="water"](${south},${west},${north},${east});
  relation["natural"="water"](${south},${west},${north},${east});
  way["waterway"~"riverbank|dock"](${south},${west},${north},${east});
  way["landuse"="reservoir"](${south},${west},${north},${east});
);
out geom;`;

  const data = await queryOverpass(query);
  return data.elements || [];
}

/**
 * Fetch coastline data within bbox.
 */
async function fetchCoastline(bbox) {
  const { south, west, north, east } = bbox;
  const query = `[out:json][timeout:55];
(
  way["natural"="coastline"](${south},${west},${north},${east});
);
out geom;`;

  const data = await queryOverpass(query);
  return data.elements || [];
}

module.exports = {
  fetchRoads,
  fetchWater,
  fetchCoastline,
  queryOverpass,
};
