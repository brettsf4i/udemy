/**
 * Server-side D3 projection utilities.
 * Uses dynamic import for d3-geo (ESM module).
 * Must match client projection exactly.
 *
 * Assumes 96 DPI: 1mm = 3.7795275591px
 */

const MM_TO_PX = 3.7795275591; // 96 DPI
const PADDING = 10; // px padding for fitExtent

let d3Cache = null;

/**
 * Lazily load d3-geo (ESM) via dynamic import.
 */
async function getD3() {
  if (!d3Cache) {
    d3Cache = await import('d3-geo');
  }
  return d3Cache;
}

/**
 * Convert millimeters to SVG pixels (96 DPI).
 */
function mmToPx(mm) {
  return mm * MM_TO_PX;
}

/**
 * Convert SVG pixels to millimeters (96 DPI).
 */
function pxToMm(px) {
  return px / MM_TO_PX;
}

/**
 * Initialize a Mercator projection fitted to the given bbox.
 * @param {Object} bbox - { south, west, north, east } in degrees
 * @param {number} outputWidthPx - Output width in pixels
 * @param {number} outputHeightPx - Output height in pixels
 * @returns {{ projection, pathGenerator }}
 */
async function initProjection(bbox, outputWidthPx, outputHeightPx) {
  const d3 = await getD3();

  // Use MultiPoint (four corners) instead of a Polygon.
  // d3-geo's fitExtent has a spherical winding-order ambiguity with small Polygons —
  // it can interpret the polygon as the inverse region (whole sphere minus the bbox),
  // producing a tiny projected area. MultiPoint avoids this entirely.
  const bboxPoints = {
    type: 'Feature',
    geometry: {
      type: 'MultiPoint',
      coordinates: [
        [bbox.west, bbox.south],
        [bbox.east, bbox.south],
        [bbox.east, bbox.north],
        [bbox.west, bbox.north],
      ],
    },
  };

  const projection = d3.geoMercator().fitExtent(
    [
      [PADDING, PADDING],
      [outputWidthPx - PADDING, outputHeightPx - PADDING],
    ],
    bboxPoints
  );

  const pathGenerator = d3.geoPath(projection);

  return { projection, pathGenerator };
}

module.exports = {
  initProjection,
  mmToPx,
  pxToMm,
  MM_TO_PX,
  PADDING,
};
