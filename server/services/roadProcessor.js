const simplify = require('simplify-js');

/** Base scores for highway types */
const ROAD_SCORES = {
  motorway: 100,
  trunk: 90,
  primary: 80,
  motorway_link: 70,
  trunk_link: 65,
  primary_link: 60,
  secondary: 50,
  secondary_link: 45,
  tertiary: 35,
  tertiary_link: 30,
  residential: 20,
  unclassified: 15,
  living_street: 10,
  service: 5,
};

/** Simplification tolerances (in degrees) */
const SIMPLIFY_TOLERANCE = {
  MAJOR: 0.00005,
  MINOR: 0.0002,
};

/**
 * Compute the importance score for a single road element.
 */
function scoreRoad(element) {
  const tags = element.tags || {};
  const highway = tags.highway || '';
  let score = ROAD_SCORES[highway] || 0;

  // Boost modifiers (additive)
  if (tags.ref) score += 15;
  if (tags.name) score += 10;
  if (tags.lanes && parseInt(tags.lanes, 10) >= 2) score += 10;
  if (tags.oneway === 'yes') score += 5;

  return score;
}

/**
 * Convert an Overpass way geometry to a coordinate array [[lon, lat], ...].
 */
function extractCoords(element) {
  if (!element.geometry || !Array.isArray(element.geometry)) {
    return [];
  }
  return element.geometry.map((node) => [node.lon, node.lat]);
}

/**
 * Compute the approximate length of a coordinate array in degrees (Euclidean).
 */
function approxLength(coords) {
  let len = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/**
 * Apply Douglas-Peucker simplification via simplify-js.
 * Converts [lon, lat] coords to {x, y} objects and back.
 */
function simplifyCoords(coords, tolerance) {
  if (coords.length < 3) return coords;
  const points = coords.map(([x, y]) => ({ x, y }));
  const simplified = simplify(points, tolerance, true);
  return simplified.map((p) => [p.x, p.y]);
}

/**
 * Convert scored roads to a GeoJSON FeatureCollection.
 */
function toFeatureCollection(scoredRoads, tolerance) {
  const features = scoredRoads.map((item) => {
    const coords = simplifyCoords(item.coords, tolerance);
    return {
      type: 'Feature',
      properties: {
        highway: item.highway,
        score: item.score,
        name: item.name || null,
        ref: item.ref || null,
      },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Main road processing pipeline.
 * @param {Array} elements - Raw Overpass way elements
 * @param {Object} options - { roadDensity: 0-100, detailLevel: 0-100 }
 * @returns {{ major, minor, stats }}
 */
function processRoads(elements, options = {}) {
  const { roadDensity = 50 } = options;
  const warnings = [];

  // Score all roads
  const scored = [];
  for (const el of elements) {
    if (el.type !== 'way') continue;
    const coords = extractCoords(el);
    if (coords.length < 2) continue;

    const score = scoreRoad(el);
    scored.push({
      id: el.id,
      highway: (el.tags || {}).highway || 'unknown',
      name: (el.tags || {}).name || null,
      ref: (el.tags || {}).ref || null,
      score,
      coords,
      length: approxLength(coords),
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const totalRoads = scored.length;

  // Handle empty/minimal cases
  if (totalRoads === 0) {
    warnings.push('No roads found in this area');
    return {
      major: { type: 'FeatureCollection', features: [] },
      minor: { type: 'FeatureCollection', features: [] },
      stats: { totalRoads: 0, majorCount: 0, minorCount: 0, droppedCount: 0, warnings },
    };
  }

  if (totalRoads < 50) {
    warnings.push(`Low road count (${totalRoads}). Using single layer mode.`);
    const all = toFeatureCollection(scored, SIMPLIFY_TOLERANCE.MAJOR);
    return {
      major: all,
      minor: { type: 'FeatureCollection', features: [] },
      stats: { totalRoads, majorCount: totalRoads, minorCount: 0, droppedCount: 0, warnings },
    };
  }

  // Compute density-adjusted percentile thresholds
  // roadDensity 0-100 scales the thresholds: higher density = more roads shown
  const densityFactor = roadDensity / 50; // 1.0 at default 50

  // Base thresholds: top 35% major, 10%-65% minor, bottom 15% drop
  let majorCutoffPct = Math.min(0.50, Math.max(0.20, 0.35 * densityFactor));
  let minorFloorPct = Math.max(0.05, 0.15 / densityFactor);

  // Compute percentile indices
  let majorCutoffIdx = Math.floor(totalRoads * majorCutoffPct);
  let minorFloorIdx = Math.floor(totalRoads * (1 - minorFloorPct));

  // Split
  let majorRoads = scored.slice(0, majorCutoffIdx);
  let minorRoads = scored.slice(majorCutoffIdx, minorFloorIdx);
  let droppedRoads = scored.slice(minorFloorIdx);

  // Minimum viability: major < 5 segments -> widen to top 50th percentile
  if (majorRoads.length < 5) {
    const newIdx = Math.floor(totalRoads * 0.50);
    majorRoads = scored.slice(0, newIdx);
    minorRoads = scored.slice(newIdx, minorFloorIdx);
    warnings.push('Few major roads detected; expanded major tier to top 50th percentile.');
  }

  // Minor empty check
  if (minorRoads.length === 0 && totalRoads >= 50) {
    warnings.push('No minor roads in tier after classification. Consider adjusting density.');
  }

  // Road density guard: if minor total length > 3x major, raise minor cutoff
  const majorLength = majorRoads.reduce((sum, r) => sum + r.length, 0);
  const minorLength = minorRoads.reduce((sum, r) => sum + r.length, 0);

  if (majorLength > 0 && minorLength > 3 * majorLength) {
    // Raise minor cutoff from wherever it was to 50th percentile
    const newMinorFloorIdx = Math.floor(totalRoads * 0.50);
    if (newMinorFloorIdx < minorFloorIdx) {
      const recut = scored.slice(majorCutoffIdx, newMinorFloorIdx);
      const reDrop = scored.slice(newMinorFloorIdx);
      minorRoads = recut;
      droppedRoads = reDrop;
      warnings.push('Minor roads density was excessive; raised cutoff to 50th percentile.');
    }
  }

  // Build GeoJSON
  const major = toFeatureCollection(majorRoads, SIMPLIFY_TOLERANCE.MAJOR);
  const minor = toFeatureCollection(minorRoads, SIMPLIFY_TOLERANCE.MINOR);

  return {
    major,
    minor,
    stats: {
      totalRoads,
      majorCount: majorRoads.length,
      minorCount: minorRoads.length,
      droppedCount: droppedRoads.length,
      warnings,
    },
  };
}

module.exports = {
  processRoads,
  scoreRoad,
  ROAD_SCORES,
};
