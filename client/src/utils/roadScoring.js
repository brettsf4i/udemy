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

/**
 * Score a single road feature based on its highway type and tag boosts.
 * @param {Object} feature - GeoJSON feature with properties including highway, ref, name, lanes, oneway
 * @returns {number} Numeric score for the road
 */
export function scoreRoad(feature) {
  const props = feature.properties || {};
  const highway = props.highway || '';
  let score = ROAD_SCORES[highway] || 0;

  // Boost modifiers (additive)
  if (props.ref) score += 15;
  if (props.name) score += 10;
  if (props.lanes !== undefined && parseInt(props.lanes, 10) >= 2) score += 10;
  if (props.oneway === 'yes') score += 5;

  return score;
}

/**
 * Approximate the geographic length of a GeoJSON LineString feature in degrees.
 * Uses simple Euclidean distance on coordinates — sufficient for relative comparison.
 * @param {Object} feature - GeoJSON feature with LineString geometry
 * @returns {number} Approximate length
 */
function approxLength(feature) {
  const coords = feature.geometry && feature.geometry.coordinates;
  if (!coords || coords.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/**
 * Compute a percentile value from a sorted array of numbers.
 * @param {number[]} sorted - Sorted array of numbers (ascending)
 * @param {number} p - Percentile (0-100)
 * @returns {number} Value at the given percentile
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Rank roads into major/minor tiers using dynamic percentile scoring.
 * @param {Object[]} features - Array of GeoJSON road features
 * @param {number} [roadDensity=70] - Density parameter (0-100) scaling percentile thresholds
 * @returns {{ majorRoads: Object[], minorRoads: Object[], warnings: string[] }}
 */
export function rankRoads(features, roadDensity = 70) {
  const warnings = [];

  if (!features || features.length === 0) {
    return { majorRoads: [], minorRoads: [], warnings: ['No road features provided'] };
  }

  // Score all features
  const scored = features.map((f) => ({ feature: f, score: scoreRoad(f) }));

  // Sort scores ascending for percentile calculation
  const sortedScores = scored.map((s) => s.score).sort((a, b) => a - b);

  // Density scaling factor (0-100 maps to 0.0-1.0)
  const densityScale = roadDensity / 100;

  // Default thresholds: major = top 35% (65th percentile), minor floor = 15th percentile, minor ceiling = 65th percentile
  // Drop bottom 15%
  let majorCutoffPct = 65 * densityScale + 65 * (1 - densityScale);
  let minorFloorPct = 15;
  let minorCeilingPct = 65;

  // Scale thresholds proportionally with density
  majorCutoffPct = 100 - (35 * densityScale);
  minorFloorPct = 15 * densityScale;
  minorCeilingPct = 65 * densityScale + 35 * (1 - densityScale);

  // Handle very small datasets: single layer with warning
  if (features.length < 50) {
    warnings.push(`Only ${features.length} roads found — using single combined layer`);
    return { majorRoads: features, minorRoads: [], warnings };
  }

  let majorThreshold = percentile(sortedScores, majorCutoffPct);
  const minorFloor = percentile(sortedScores, minorFloorPct);
  let minorCeiling = percentile(sortedScores, minorCeilingPct);

  // Initial classification
  let majorRoads = scored.filter((s) => s.score >= majorThreshold).map((s) => s.feature);
  let minorRoads = scored
    .filter((s) => s.score >= minorFloor && s.score < majorThreshold && s.score <= minorCeiling)
    .map((s) => s.feature);

  // Minimum viability: if major < 5, lower threshold to top 50%
  if (majorRoads.length < 5) {
    warnings.push('Very few major roads detected — lowering threshold to top 50%');
    majorThreshold = percentile(sortedScores, 50);
    majorRoads = scored.filter((s) => s.score >= majorThreshold).map((s) => s.feature);
    minorRoads = scored
      .filter((s) => s.score >= minorFloor && s.score < majorThreshold)
      .map((s) => s.feature);
  }

  // Density guard: if minor total length > 3x major total length, raise minor cutoff
  const majorLength = majorRoads.reduce((sum, f) => sum + approxLength(f), 0);
  const minorLength = minorRoads.reduce((sum, f) => sum + approxLength(f), 0);

  if (majorLength > 0 && minorLength > 3 * majorLength) {
    warnings.push('Minor roads significantly outnumber major — raising minor cutoff from 65th to 50th percentile');
    const raisedCeiling = percentile(sortedScores, 50);
    minorRoads = scored
      .filter((s) => s.score >= minorFloor && s.score < majorThreshold && s.score <= raisedCeiling)
      .map((s) => s.feature);
  }

  return { majorRoads, minorRoads, warnings };
}
