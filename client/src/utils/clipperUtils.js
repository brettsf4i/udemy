import ClipperLib from 'clipper-lib';

const CLIPPER_SCALE = 1000000;

/**
 * Expand a road centerline to a polygon of given width.
 * @param {number[][]} coordinates - Array of [x, y] projected coordinate pairs
 * @param {number} widthPx - Half-width expansion in SVG pixels
 * @returns {ClipperLib.Paths} Array of clipper paths representing the expanded polygon
 */
export function expandRoadToPolygon(coordinates, widthPx) {
  const path = coordinates.map(([x, y]) => ({
    X: Math.round(x * CLIPPER_SCALE),
    Y: Math.round(y * CLIPPER_SCALE),
  }));

  const co = new ClipperLib.ClipperOffset();
  const solution = new ClipperLib.Paths();

  co.AddPath(
    path,
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etOpenRound
  );
  co.Execute(solution, widthPx * CLIPPER_SCALE);

  return solution;
}

/**
 * Union all expanded road polygons into one combined shape.
 * @param {ClipperLib.Paths[]} polygonPaths - Array of clipper path arrays to union
 * @returns {ClipperLib.Paths} Unified clipper paths
 */
export function unionPolygons(polygonPaths) {
  if (polygonPaths.length === 0) return [];

  const clipper = new ClipperLib.Clipper();
  let accumulated = polygonPaths[0];

  for (let i = 1; i < polygonPaths.length; i++) {
    const result = new ClipperLib.Paths();
    clipper.Clear();
    for (const path of accumulated) {
      clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true);
    }
    for (const path of polygonPaths[i]) {
      clipper.AddPath(path, ClipperLib.PolyType.ptClip, true);
    }
    clipper.Execute(
      ClipperLib.ClipType.ctUnion,
      result,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );
    accumulated = result;
  }

  return accumulated;
}

/**
 * Convert clipper paths back to an SVG path `d` attribute string.
 * @param {ClipperLib.Paths} paths - Array of clipper paths
 * @returns {string} SVG path d string
 */
export function clipperPathToSvgD(paths) {
  return paths
    .map((path) => {
      if (path.length === 0) return '';
      const points = path.map(
        (p) => `${p.X / CLIPPER_SCALE},${p.Y / CLIPPER_SCALE}`
      );
      return `M${points.join('L')}Z`;
    })
    .join(' ');
}
