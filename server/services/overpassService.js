const axios = require('axios');

// Working public Overpass endpoints — tried in order until one succeeds.
// maps.mail.ru removed (returns 403 for non-Russian traffic).
// z. and lz4. are additional overpass-api.de load-balanced servers.
const OVERPASS_ENDPOINTS = process.env.OVERPASS_API_URL
  ? [process.env.OVERPASS_API_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

// Axios timeout per attempt
const OVERPASS_TIMEOUT = parseInt(process.env.OVERPASS_TIMEOUT_MS, 10) || 60000;

/**
 * Execute an Overpass QL query, trying each endpoint in turn.
 * Moves to next mirror on 429 / 504 / 503 / timeout.
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
        err.code === 'ECONNABORTED' ||
        status === 429 ||
        status === 503 ||
        status === 504;

      console.warn(`[Overpass] ${url} failed: ${status || err.code || err.message}`);
      lastErr = err;

      if (!isRetriable) {
        // 403/400/etc — hard error, skip remaining mirrors
        break;
      }
      // Soft error — try next mirror immediately
    }
  }

  const status = lastErr?.response?.status;
  const msg = status
    ? `Overpass API unavailable (${status}). Try a smaller area or try again shortly.`
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
 * Staggered 200ms after roads to avoid hammering the same endpoint simultaneously.
 */
async function fetchWater(bbox) {
  await new Promise(r => setTimeout(r, 200));
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
 * Staggered 400ms after roads.
 */
async function fetchCoastline(bbox) {
  await new Promise(r => setTimeout(r, 400));
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
