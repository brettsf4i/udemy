/**
 * Convert Overpass water elements to GeoJSON polygons.
 * Handles both ways (simple polygons) and relations (multipolygons).
 */

/**
 * Convert a single way element to a polygon feature.
 */
function wayToFeature(element) {
  if (!element.geometry || element.geometry.length < 3) return null;

  const coords = element.geometry.map((n) => [n.lon, n.lat]);

  // Ensure ring is closed
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([...first]);
  }

  if (coords.length < 4) return null;

  return {
    type: 'Feature',
    properties: {
      id: element.id,
      type: (element.tags || {}).natural || (element.tags || {}).waterway || (element.tags || {}).landuse || 'water',
      name: (element.tags || {}).name || null,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

/**
 * Convert a relation element (multipolygon) to a polygon or multipolygon feature.
 * Relations have members with roles "outer" and "inner".
 */
function relationToFeature(element) {
  if (!element.members || element.members.length === 0) return null;

  const outerRings = [];
  const innerRings = [];

  for (const member of element.members) {
    if (member.type !== 'way' || !member.geometry || member.geometry.length < 3) continue;

    const coords = member.geometry.map((n) => [n.lon, n.lat]);

    // Ensure ring is closed
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([...first]);
    }

    if (coords.length < 4) continue;

    if (member.role === 'inner') {
      innerRings.push(coords);
    } else {
      // Default to outer for 'outer' role or unspecified
      outerRings.push(coords);
    }
  }

  if (outerRings.length === 0) return null;

  // If single outer ring, create a Polygon with possible inner rings (holes)
  if (outerRings.length === 1) {
    const coordinates = [outerRings[0], ...innerRings];
    return {
      type: 'Feature',
      properties: {
        id: element.id,
        type: (element.tags || {}).natural || (element.tags || {}).waterway || (element.tags || {}).landuse || 'water',
        name: (element.tags || {}).name || null,
      },
      geometry: {
        type: 'Polygon',
        coordinates,
      },
    };
  }

  // Multiple outer rings: create MultiPolygon
  // Assign inner rings to their containing outer ring by simple bbox check
  const polygons = outerRings.map((outer) => {
    const outerBbox = ringBbox(outer);
    const holes = innerRings.filter((inner) => {
      const pt = inner[0];
      return (
        pt[0] >= outerBbox.minLon &&
        pt[0] <= outerBbox.maxLon &&
        pt[1] >= outerBbox.minLat &&
        pt[1] <= outerBbox.maxLat
      );
    });
    return [outer, ...holes];
  });

  return {
    type: 'Feature',
    properties: {
      id: element.id,
      type: (element.tags || {}).natural || (element.tags || {}).waterway || (element.tags || {}).landuse || 'water',
      name: (element.tags || {}).name || null,
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: polygons,
    },
  };
}

/**
 * Compute bounding box for a ring.
 */
function ringBbox(ring) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Main water processing entry point.
 * @param {Array} elements - Raw Overpass water elements
 * @returns {Object} GeoJSON FeatureCollection
 */
function processWater(elements) {
  const features = [];

  for (const el of elements) {
    let feature = null;

    if (el.type === 'way') {
      feature = wayToFeature(el);
    } else if (el.type === 'relation') {
      feature = relationToFeature(el);
    }

    if (feature) {
      features.push(feature);
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

module.exports = {
  processWater,
  wayToFeature,
  relationToFeature,
};
