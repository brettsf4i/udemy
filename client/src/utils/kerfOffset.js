// Convert mm measurements to SVG pixel units
// Standard: 96 DPI -> 1mm = 3.7795px
const MM_TO_PX = 3.7795275591;

export function mmToPx(mm) {
  return mm * MM_TO_PX;
}

export function pxToMm(px) {
  return px / MM_TO_PX;
}

// Calculate kerf-compensated dimensions
// kerf = total material removed by laser beam width
export function applyKerfOffset(pathWidthMm, kerfMm) {
  return pathWidthMm - kerfMm;
}

// Get road expansion width in SVG pixels based on road score
export function getRoadExpansionPx(score, outputWidthMm, outputWidthPx) {
  const scale = outputWidthPx / outputWidthMm;
  let widthMm;
  if (score >= 80) widthMm = 2.0;
  else if (score >= 45) widthMm = 1.4;
  else widthMm = 0.9;
  return widthMm * scale;
}

// Get registration mark dimensions in pixels
export function getRegistrationMarkPx(outputWidthMm, outputWidthPx) {
  const scale = outputWidthPx / outputWidthMm;
  return {
    diameter: 3 * scale,
    inset: 8 * scale,
    radius: 1.5 * scale,
  };
}
