/**
 * Chain OSM coastline way segments into closed land polygons.
 *
 * OSM coastline ways are directed so that land is on the left (water on the right).
 * Ways may be split across multiple segments that need to be joined end-to-start
 * to form complete rings.
 */

/**
 * Generate a string key for a coordinate pair.
 * @param {number} lon
 * @param {number} lat
 * @returns {string}
 */
function nodeKey(lon, lat) {
  return `${lon.toFixed(7)},${lat.toFixed(7)}`;
}

/**
 * Chain an array of OSM coastline ways into closed coordinate rings.
 *
 * @param {Object[]} ways - Array of OSM way objects. Each must have a `geometry` array
 *   of { lon, lat } objects (Overpass "out geom" format) OR a GeoJSON-style
 *   `coordinates` array of [lon, lat] pairs.
 * @returns {number[][][]} Array of closed rings, each ring is an array of [lon, lat] pairs
 *   where the first coordinate equals the last.
 */
export function chainCoastlineWays(ways) {
  if (!ways || ways.length === 0) return [];

  // Normalize ways to arrays of [lon, lat] coordinate pairs
  const segments = ways.map((way) => {
    if (way.geometry && Array.isArray(way.geometry)) {
      // Overpass "out geom" format: array of { lon, lat }
      return way.geometry.map((node) => [node.lon, node.lat]);
    }
    if (way.coordinates && Array.isArray(way.coordinates)) {
      return way.coordinates;
    }
    if (
      way.geometry &&
      way.geometry.coordinates &&
      Array.isArray(way.geometry.coordinates)
    ) {
      // GeoJSON LineString
      return way.geometry.coordinates;
    }
    return [];
  }).filter((seg) => seg.length >= 2);

  if (segments.length === 0) return [];

  // Build chains by connecting segments end-to-start
  // Map from start-node key to segment index for quick lookup
  const startMap = new Map();
  const used = new Set();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const key = nodeKey(seg[0][0], seg[0][1]);
    // If multiple segments start at the same node, keep the last one
    // (rare edge case; in practice coastline ways don't share start nodes)
    startMap.set(key, i);
  }

  const rings = [];

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;

    // Start a new chain from this segment
    let chain = [...segments[i]];
    used.add(i);

    // Keep extending the chain by finding a segment whose start matches our end
    let extended = true;
    while (extended) {
      extended = false;
      const endCoord = chain[chain.length - 1];
      const endKey = nodeKey(endCoord[0], endCoord[1]);

      // Check if chain is already closed
      const startCoord = chain[0];
      if (
        chain.length >= 4 &&
        nodeKey(startCoord[0], startCoord[1]) === endKey
      ) {
        break;
      }

      const nextIdx = startMap.get(endKey);
      if (nextIdx !== undefined && !used.has(nextIdx)) {
        used.add(nextIdx);
        // Append the next segment (skip its first coord since it matches our end)
        chain = chain.concat(segments[nextIdx].slice(1));
        extended = true;
      }
    }

    // Close the ring if not already closed
    const first = chain[0];
    const last = chain[chain.length - 1];
    if (
      nodeKey(first[0], first[1]) !== nodeKey(last[0], last[1])
    ) {
      chain.push([first[0], first[1]]);
    }

    // Validate: ring must have at least 4 coordinates (3 unique + closing)
    if (chain.length >= 4) {
      rings.push(chain);
    }
  }

  return rings;
}

/**
 * Create a GeoJSON Polygon feature from a bounding box.
 * Useful as a fallback land polygon for inland cities with no coastline data.
 *
 * @param {{ south: number, west: number, north: number, east: number }} bbox
 * @returns {Object} GeoJSON Feature with Polygon geometry
 */
export function createBboxPolygon(bbox) {
  const { south, west, north, east } = bbox;
  const ring = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}
