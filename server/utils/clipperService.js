const ClipperLib = require('clipper-lib');
const { mmToPx } = require('./projectionServer');

/**
 * Clipper uses integer coordinates. We scale SVG px coordinates up by this factor
 * for precision, then scale back down when generating the SVG path.
 */
const CLIPPER_SCALE = 1000;

/**
 * Determine expansion width in mm based on road score.
 * Score >= 80: 2.0mm
 * Score 45-79: 1.4mm
 * Score 30-44: 0.9mm
 * Score < 30:  0.6mm (fallback)
 */
function getExpansionMm(score) {
  if (score >= 80) return 2.0;
  if (score >= 45) return 1.4;
  if (score >= 30) return 0.9;
  return 0.6;
}

/**
 * Project GeoJSON coordinates through d3 projection and convert to Clipper integer points.
 * @param {Array} coords - [[lon, lat], ...]
 * @param {Function} projection - d3 projection function
 * @returns {Array} [{X, Y}, ...]
 */
function projectToClipper(coords, projection) {
  const points = [];
  for (const coord of coords) {
    const projected = projection(coord);
    if (!projected || isNaN(projected[0]) || isNaN(projected[1])) continue;
    points.push({
      X: Math.round(projected[0] * CLIPPER_SCALE),
      Y: Math.round(projected[1] * CLIPPER_SCALE),
    });
  }
  return points;
}

/**
 * Expand a polyline path using ClipperOffset with round joins/ends.
 * @param {Array} clipperPath - [{X, Y}, ...]
 * @param {number} offsetPx - Offset distance in SVG pixels (half the total width)
 * @returns {Array} Array of solution paths
 */
function expandPath(clipperPath, offsetPx) {
  if (clipperPath.length < 2) return [];

  const co = new ClipperLib.ClipperOffset();
  co.ArcTolerance = 0.25 * CLIPPER_SCALE;

  co.AddPath(
    clipperPath,
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etOpenRound
  );

  const solution = new ClipperLib.Paths();
  co.Execute(solution, offsetPx * CLIPPER_SCALE);

  return solution;
}

/**
 * Union all expanded polygons into a single unified shape.
 * @param {Array} allPaths - Array of Clipper paths (each is [{X, Y}, ...])
 * @returns {Array} Unified solution paths
 */
function unionPaths(allPaths) {
  if (allPaths.length === 0) return [];

  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(allPaths, ClipperLib.PolyType.ptSubject, true);

  const solution = new ClipperLib.Paths();
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return solution;
}

/**
 * Convert unified Clipper paths to an SVG path d attribute.
 * @param {Array} paths - Array of Clipper paths
 * @returns {string} SVG path d attribute
 */
function clipperPathsToSvgD(paths) {
  const parts = [];

  for (const path of paths) {
    if (path.length < 3) continue;
    const segments = [];
    for (let i = 0; i < path.length; i++) {
      const x = (path[i].X / CLIPPER_SCALE).toFixed(2);
      const y = (path[i].Y / CLIPPER_SCALE).toFixed(2);
      if (i === 0) {
        segments.push(`M${x},${y}`);
      } else {
        segments.push(`L${x},${y}`);
      }
    }
    segments.push('Z');
    parts.push(segments.join(' '));
  }

  return parts.join(' ');
}

/**
 * Main entry: expand all major road features into cut polygons and union them.
 * @param {Object} majorFC - GeoJSON FeatureCollection of major roads
 * @param {Function} projection - d3 projection function
 * @param {number} widthMm - Output width in mm (unused but kept for API consistency)
 * @returns {string} SVG path d attribute for the unified road polygons
 */
function expandAndUnionRoads(majorFC, projection, widthMm) {
  if (!majorFC || !majorFC.features || majorFC.features.length === 0) {
    return '';
  }

  const allExpanded = [];

  for (const feature of majorFC.features) {
    const score = (feature.properties && feature.properties.score) || 0;
    const expansionMm = getExpansionMm(score);
    const expansionPx = mmToPx(expansionMm) / 2; // Offset is half the total width

    const coords = feature.geometry && feature.geometry.coordinates;
    if (!coords || coords.length < 2) continue;

    const clipperPath = projectToClipper(coords, projection);
    if (clipperPath.length < 2) continue;

    const expanded = expandPath(clipperPath, expansionPx);
    for (const path of expanded) {
      if (path.length >= 3) {
        allExpanded.push(path);
      }
    }
  }

  if (allExpanded.length === 0) return '';

  // Union all expanded polygons
  const unified = unionPaths(allExpanded);

  // Convert to SVG path d attribute
  return clipperPathsToSvgD(unified);
}

module.exports = {
  expandAndUnionRoads,
  getExpansionMm,
  projectToClipper,
  expandPath,
  unionPaths,
  clipperPathsToSvgD,
  CLIPPER_SCALE,
};
