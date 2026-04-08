const { initProjection, mmToPx } = require('../utils/projectionServer');
const { generateRegistrationMarks } = require('../utils/registrationMarks');
const clipperService = require('../utils/clipperService');

/**
 * Build all 3 SVG layer strings for laser cutting.
 *
 * Layer 3 (base): Land silhouette with water holes (fill-rule="evenodd"), registration marks
 * Layer 2 (minor roads): Water cutouts, minor road engrave paths, text, registration marks
 * Layer 1 (major roads): Water cutouts, major road cut polygons (unified from clipper), registration marks
 */
async function buildAllLayers({ layers, bbox, widthMm, heightMm, kerf, cityName, customMessage }) {
  const widthPx = mmToPx(widthMm);
  const heightPx = mmToPx(heightMm);

  // Log incoming data for debugging
  console.log('[svgBuilder] Building SVGs:', {
    widthMm, heightMm, cityName,
    majorRoads: layers.majorRoads?.features?.length ?? 'null',
    minorRoads: layers.minorRoads?.features?.length ?? 'null',
    water: layers.water?.features?.length ?? 'null',
    coastline: layers.coastline?.features?.length ?? 'null',
  });

  // Build bbox GeoJSON for projection fitting
  const bboxGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [bbox.west, bbox.south],
        [bbox.east, bbox.south],
        [bbox.east, bbox.north],
        [bbox.west, bbox.north],
        [bbox.west, bbox.south],
      ]],
    },
  };

  const { pathGenerator, projection } = await initProjection(bboxGeoJSON, widthPx, heightPx);

  // Spot-check: try projecting the bbox center to verify projection is working
  const centerLon = (bbox.west + bbox.east) / 2;
  const centerLat = (bbox.south + bbox.north) / 2;
  const testPt = projection([centerLon, centerLat]);
  console.log('[svgBuilder] Projection center test:', testPt);

  // Generate water paths (identical across all 3 layers)
  const waterPathsStr = generateWaterPaths(layers.water, pathGenerator);

  // Generate registration marks (identical across all layers)
  const regMarks = generateRegistrationMarks(widthPx, heightPx);

  // Compute text sizing
  const fontSize = Math.min(28, Math.max(12, heightPx * 0.04));
  const textInset = mmToPx(8);

  // --- Layer 3: Base (land silhouette + water holes) ---
  const landPath = generateLandPath(layers.coastline, pathGenerator, bbox, widthPx, heightPx);
  const layer3 = buildSvgDocument(widthPx, heightPx, [
    `<g id="land-silhouette">`,
    `  <path d="${landPath}" stroke="#000000" stroke-width="0.5" fill="none" fill-rule="evenodd"/>`,
    `</g>`,
    `<g id="water-cutouts">`,
    waterPathsStr,
    `</g>`,
    regMarks,
  ]);

  // --- Layer 2: Minor roads + water + text ---
  const minorRoadPaths = generateRoadPaths(
    layers.minorRoads,
    pathGenerator,
    '#444444',
    '0.3'
  );
  const textElements = generateTextElements(cityName, customMessage, widthPx, heightPx, fontSize, textInset);
  const layer2 = buildSvgDocument(widthPx, heightPx, [
    `<g id="water-cutouts">`,
    waterPathsStr,
    `</g>`,
    `<g id="minor-roads">`,
    minorRoadPaths,
    `</g>`,
    textElements,
    regMarks,
  ]);

  // --- Layer 1: Major roads (expanded polygons) + water ---
  const majorRoadPolygons = await generateMajorRoadPolygons(
    layers.majorRoads,
    projection,
    pathGenerator,
    widthMm
  );
  const layer1 = buildSvgDocument(widthPx, heightPx, [
    `<g id="water-cutouts">`,
    waterPathsStr,
    `</g>`,
    `<g id="major-road-polygons">`,
    majorRoadPolygons,
    `</g>`,
    regMarks,
  ]);

  console.log('[svgBuilder] Done. Layer sizes (chars):', {
    layer1: layer1.length,
    layer2: layer2.length,
    layer3: layer3.length,
  });

  return { layer1, layer2, layer3 };
}

/**
 * Build a complete SVG document string.
 */
function buildSvgDocument(widthPx, heightPx, contentLines) {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">`,
    ...contentLines,
    `</svg>`,
  ];
  return lines.join('\n');
}

/**
 * Generate the land outline path. Uses coastline polygons or bbox fallback.
 */
function generateLandPath(coastlineFC, pathGenerator, bbox, widthPx, heightPx) {
  if (!coastlineFC || !coastlineFC.features || coastlineFC.features.length === 0) {
    // Fallback: full bbox rectangle
    return `M0,0 L${widthPx},0 L${widthPx},${heightPx} L0,${heightPx} Z`;
  }

  const paths = [];
  for (const feature of coastlineFC.features) {
    const d = pathGenerator(feature);
    if (d) paths.push(d);
  }

  if (paths.length === 0) {
    console.warn('[svgBuilder] coastline pathGenerator returned empty for all features — using bbox fallback');
    return `M0,0 L${widthPx},0 L${widthPx},${heightPx} L0,${heightPx} Z`;
  }

  console.log(`[svgBuilder] coastline: ${paths.length} paths generated`);
  return paths.join(' ');
}

/**
 * Generate water cut paths as SVG path elements.
 * These are IDENTICAL across all 3 layers.
 */
function generateWaterPaths(waterFC, pathGenerator) {
  if (!waterFC || !waterFC.features || waterFC.features.length === 0) {
    return '<!-- no water features -->';
  }

  const lines = [];
  for (const feature of waterFC.features) {
    const d = pathGenerator(feature);
    if (d) {
      lines.push(`  <path d="${d}" stroke="#000000" stroke-width="0.5" fill="none"/>`);
    }
  }

  console.log(`[svgBuilder] water: ${lines.length}/${waterFC.features.length} paths generated`);
  return lines.length > 0 ? lines.join('\n') : '<!-- no water features rendered -->';
}

/**
 * Generate road engrave/cut paths as SVG path elements.
 */
function generateRoadPaths(roadFC, pathGenerator, stroke, strokeWidth) {
  if (!roadFC || !roadFC.features || roadFC.features.length === 0) {
    return '<!-- no roads -->';
  }

  const lines = [];
  for (const feature of roadFC.features) {
    const d = pathGenerator(feature);
    if (d) {
      lines.push(`  <path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"/>`);
    }
  }

  console.log(`[svgBuilder] roads (${stroke}): ${lines.length}/${roadFC.features.length} paths generated`);
  return lines.length > 0 ? lines.join('\n') : '<!-- no roads rendered -->';
}

/**
 * Generate major road expanded polygons using clipper offset + union.
 * Falls back to centerline strokes if clipper fails.
 */
async function generateMajorRoadPolygons(majorFC, projection, pathGenerator, widthMm) {
  if (!majorFC || !majorFC.features || majorFC.features.length === 0) {
    return '<!-- no major roads -->';
  }

  // Try clipper expansion first
  try {
    const pathData = clipperService.expandAndUnionRoads(majorFC, projection, widthMm);

    if (pathData && pathData.length > 0) {
      console.log(`[svgBuilder] major roads: clipper produced ${pathData.length} chars`);
      return `  <path d="${pathData}" stroke="#000000" stroke-width="0.5" fill="none"/>`;
    }
    console.warn('[svgBuilder] Clipper returned empty path — falling back to centerlines');
  } catch (err) {
    console.error('[svgBuilder] Clipper expansion threw:', err.message);
  }

  // Fallback: render major roads as thick centerline strokes
  return generateRoadPaths(majorFC, pathGenerator, '#000000', '1.5');
}

/**
 * Generate text elements for city name and custom message.
 */
function generateTextElements(cityName, customMessage, widthPx, heightPx, fontSize, textInset) {
  const lines = [];
  const yPos = heightPx - textInset;

  if (cityName) {
    lines.push(
      `<text x="${textInset}" y="${yPos}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="none" stroke="#444444" stroke-width="0.3" text-anchor="start">${escapeXml(cityName)}</text>`
    );
  }

  if (customMessage) {
    lines.push(
      `<text x="${widthPx - textInset}" y="${yPos}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="none" stroke="#444444" stroke-width="0.3" text-anchor="end">${escapeXml(customMessage)}</text>`
    );
  }

  return lines.join('\n');
}

/**
 * Escape XML special characters.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  buildAllLayers,
};
