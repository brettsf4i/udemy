/**
 * Process raw Overpass coastline elements into closed polygon(s).
 * Falls back to bbox rectangle for inland cities with no coastline.
 */

/**
 * Chain OSM way segments into closed polygons.
 * OSM coastline ways are ordered so land is on the left.
 * We build an adjacency map from end-node to start-node and walk chains.
 */
function chainWays(elements) {
  // Extract coordinate sequences from each way
  const segments = [];
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const coords = el.geometry.map((n) => [n.lon, n.lat]);
    segments.push(coords);
  }

  if (segments.length === 0) return [];

  // Build adjacency: key = "lon,lat" of end point, value = segment index
  // We chain segment[i]'s last point to segment[j]'s first point
  const startMap = new Map(); // startKey -> [segIndex, ...]
  const used = new Set();

  for (let i = 0; i < segments.length; i++) {
    const first = segments[i][0];
    const key = coordKey(first);
    if (!startMap.has(key)) startMap.set(key, []);
    startMap.get(key).push(i);
  }

  const rings = [];

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;

    // Start a new chain
    const chain = [...segments[i]];
    used.add(i);

    let maxIterations = segments.length;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      const lastPt = chain[chain.length - 1];
      const lastKey = coordKey(lastPt);

      // Check if ring is closed
      const firstPt = chain[0];
      if (chain.length >= 4 && coordKey(lastPt) === coordKey(firstPt)) {
        // Ensure last == first exactly
        chain[chain.length - 1] = [...chain[0]];
        rings.push(chain);
        break;
      }

      // Find next segment whose start matches our end
      const candidates = startMap.get(lastKey) || [];
      let found = false;
      for (const idx of candidates) {
        if (used.has(idx)) continue;
        used.add(idx);
        // Append segment (skip first point to avoid duplicate)
        for (let j = 1; j < segments[idx].length; j++) {
          chain.push(segments[idx][j]);
        }
        found = true;
        break;
      }

      if (!found) {
        // Cannot continue chain; if long enough, try closing it
        if (chain.length >= 4) {
          chain.push([...chain[0]]);
          rings.push(chain);
        }
        break;
      }
    }

    // If we exhausted iterations without closing, still save if viable
    if (iterations >= maxIterations && chain.length >= 4) {
      chain.push([...chain[0]]);
      rings.push(chain);
    }
  }

  return rings;
}

function coordKey(coord) {
  // Use fixed precision to handle floating point matching
  return `${coord[0].toFixed(7)},${coord[1].toFixed(7)}`;
}

/**
 * Validate a ring: at least 4 coords, first == last.
 */
function validateRing(ring) {
  if (!ring || ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

/**
 * Generate a bbox rectangle as a closed polygon (fallback for inland cities).
 */
function bboxToPolygon(bbox) {
  const { south, west, north, east } = bbox;
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

/**
 * Main coastline processing entry point.
 * @param {Array} elements - Raw Overpass coastline elements
 * @param {Object} bbox - { south, west, north, east }
 * @returns {Object} GeoJSON FeatureCollection with optional warning
 */
function processCoastline(elements, bbox) {
  const rings = chainWays(elements);
  const validRings = rings.filter(validateRing);

  // Fallback: no coastline found (inland city)
  if (validRings.length === 0) {
    const bboxRing = bboxToPolygon(bbox);
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { source: 'bbox_fallback' },
          geometry: {
            type: 'Polygon',
            coordinates: [bboxRing],
          },
        },
      ],
      warning: 'No coastline found; using bounding box as land polygon (inland city).',
    };
  }

  // Build features from valid rings
  const features = validRings.map((ring, idx) => ({
    type: 'Feature',
    properties: { source: 'coastline', ringIndex: idx },
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

module.exports = {
  processCoastline,
  chainWays,
  bboxToPolygon,
};
