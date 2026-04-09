import { geoMercator, geoPath } from 'd3-geo';

let _projection = null;
let _pathGenerator = null;

/**
 * Initialize a Mercator projection fitted to the given bbox.
 * @param {Object} bboxGeoJSON - GeoJSON Feature (any geometry) OR { south, west, north, east }
 */
export function initProjection(bboxGeoJSON, outputWidthPx, outputHeightPx) {
  // Accept either a raw bbox object { south, west, north, east } or a GeoJSON Feature.
  // Always convert to a MultiPoint of the four corners to avoid d3-geo's spherical
  // winding-order ambiguity, which causes small Polygon bboxes to project as a dot.
  let fitTarget;
  if (bboxGeoJSON && bboxGeoJSON.type === 'Feature') {
    fitTarget = bboxGeoJSON;
  } else if (bboxGeoJSON && 'south' in bboxGeoJSON) {
    const { south, west, north, east } = bboxGeoJSON;
    fitTarget = {
      type: 'Feature',
      geometry: {
        type: 'MultiPoint',
        coordinates: [
          [west, south], [east, south], [east, north], [west, north],
        ],
      },
    };
  } else {
    fitTarget = bboxGeoJSON;
  }

  _projection = geoMercator()
    .fitExtent(
      [[10, 10], [outputWidthPx - 10, outputHeightPx - 10]],
      fitTarget
    );
  _pathGenerator = geoPath().projection(_projection);
  return { projection: _projection, pathGenerator: _pathGenerator };
}

export function getPathGenerator() {
  if (!_pathGenerator) throw new Error('Projection not initialized');
  return _pathGenerator;
}

export function getProjection() {
  if (!_projection) throw new Error('Projection not initialized');
  return _projection;
}

export function resetProjection() {
  _projection = null;
  _pathGenerator = null;
}
