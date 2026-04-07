const axios = require('axios');

const OVERPASS_URL = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT = parseInt(process.env.OVERPASS_TIMEOUT_MS, 10) || 30000;

/**
 * Execute an Overpass query with retry logic.
 * On timeout (status 429 or ECONNABORTED), waits 3-5s then retries once.
 */
async function queryOverpass(qlQuery) {
  const executeRequest = () =>
    axios.post(OVERPASS_URL, `data=${encodeURIComponent(qlQuery)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: OVERPASS_TIMEOUT,
    });

  try {
    const response = await executeRequest();
    return response.data;
  } catch (firstError) {
    const shouldRetry =
      firstError.code === 'ECONNABORTED' ||
      (firstError.response && firstError.response.status === 429) ||
      (firstError.response && firstError.response.status === 504);

    if (!shouldRetry) {
      const msg = firstError.response
        ? `Overpass API error: ${firstError.response.status} ${firstError.response.statusText}`
        : `Overpass request failed: ${firstError.message}`;
      const err = new Error(msg);
      err.statusCode = 502;
      err.expose = true;
      throw err;
    }

    // Wait 3-5s before retry
    const delay = 3000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const response = await executeRequest();
      return response.data;
    } catch (retryError) {
      const msg = retryError.response
        ? `Overpass API error after retry: ${retryError.response.status} ${retryError.response.statusText}`
        : `Overpass request failed after retry: ${retryError.message}`;
      const err = new Error(msg);
      err.statusCode = 502;
      err.expose = true;
      throw err;
    }
  }
}

/**
 * Fetch road data within bbox.
 */
async function fetchRoads(bbox) {
  const { south, west, north, east } = bbox;
  const query = `[out:json][timeout:30];
(
  way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service"]
  (${south},${west},${north},${east});
);
out geom;`;

  const data = await queryOverpass(query);
  return data.elements || [];
}

/**
 * Fetch water features within bbox.
 */
async function fetchWater(bbox) {
  const { south, west, north, east } = bbox;
  const query = `[out:json][timeout:30];
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
  const query = `[out:json][timeout:30];
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
