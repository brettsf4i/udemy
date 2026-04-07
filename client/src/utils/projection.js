import { geoMercator, geoPath } from 'd3-geo';

let _projection = null;
let _pathGenerator = null;

export function initProjection(bboxGeoJSON, outputWidthPx, outputHeightPx) {
  _projection = geoMercator()
    .fitExtent(
      [[10, 10], [outputWidthPx - 10, outputHeightPx - 10]],
      bboxGeoJSON
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
