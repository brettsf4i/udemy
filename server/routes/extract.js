const { Router } = require('express');
const overpassService = require('../services/overpassService');
const roadProcessor = require('../services/roadProcessor');
const coastlineProcessor = require('../services/coastlineProcessor');
const waterProcessor = require('../services/waterProcessor');

const router = Router();

const MAX_BBOX_DEGREES = parseFloat(process.env.MAX_BBOX_DEGREES) || 0.5;
const MIN_BBOX_DEGREES = parseFloat(process.env.MIN_BBOX_DEGREES) || 0.01;

function validateBbox(bbox) {
  const { south, west, north, east } = bbox || {};

  if (south == null || west == null || north == null || east == null) {
    return 'bbox must include south, west, north, east';
  }

  if (typeof south !== 'number' || typeof west !== 'number' ||
      typeof north !== 'number' || typeof east !== 'number') {
    return 'bbox values must be numbers';
  }

  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return 'latitude must be between -90 and 90';
  }

  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return 'longitude must be between -180 and 180';
  }

  if (south >= north) {
    return 'south must be less than north';
  }

  const latSpan = north - south;
  const lonSpan = east - west;

  if (latSpan > MAX_BBOX_DEGREES || lonSpan > MAX_BBOX_DEGREES) {
    return `bbox span exceeds maximum of ${MAX_BBOX_DEGREES} degrees. Reduce the area.`;
  }

  if (latSpan < MIN_BBOX_DEGREES && lonSpan < MIN_BBOX_DEGREES) {
    return `bbox span below minimum of ${MIN_BBOX_DEGREES} degrees. Increase the area.`;
  }

  return null;
}

router.post('/', async (req, res, next) => {
  try {
    const { bbox, settings } = req.body;

    const bboxError = validateBbox(bbox);
    if (bboxError) {
      const err = new Error(bboxError);
      err.statusCode = 400;
      err.expose = true;
      throw err;
    }

    const {
      outputSize = { widthMm: 300, heightMm: 300 },
      kerf = 0.2,
      roadDensity = 50,
      detailLevel = 50,
    } = settings || {};

    // Fire 3 parallel Overpass requests — water and coastline failures are non-fatal
    const warnings = [];

    const [roadsResult, waterResult, coastlineResult] = await Promise.allSettled([
      overpassService.fetchRoads(bbox),
      overpassService.fetchWater(bbox),
      overpassService.fetchCoastline(bbox),
    ]);

    // Roads are required
    if (roadsResult.status === 'rejected') {
      const err = new Error(roadsResult.reason?.message || 'Failed to fetch road data');
      err.statusCode = 502;
      err.expose = true;
      throw err;
    }
    const roadsRaw = roadsResult.value;

    // Water is optional
    let waterRaw = [];
    if (waterResult.status === 'fulfilled') {
      waterRaw = waterResult.value;
    } else {
      warnings.push('Water data unavailable — continuing without water features');
      console.warn('[WARN] Water fetch failed:', waterResult.reason?.message);
    }

    // Coastline is optional
    let coastlineRaw = [];
    if (coastlineResult.status === 'fulfilled') {
      coastlineRaw = coastlineResult.value;
    } else {
      warnings.push('Coastline data unavailable — using bounding box as land area');
      console.warn('[WARN] Coastline fetch failed:', coastlineResult.reason?.message);
    }

    // Process roads
    const roadResult = roadProcessor.processRoads(roadsRaw, {
      roadDensity,
      detailLevel,
    });

    // Process coastline
    const coastlineProcessed = coastlineProcessor.processCoastline(coastlineRaw, bbox);

    // Process water
    const waterProcessed = waterProcessor.processWater(waterRaw);

    warnings.push(...roadResult.stats.warnings);
    if (coastlineProcessed.warning) {
      warnings.push(coastlineProcessed.warning);
    }

    // Build response matching frontend expected shape
    const response = {
      layers: {
        majorRoads: roadResult.major,
        minorRoads: roadResult.minor,
        coastline: coastlineProcessed,
        water: waterProcessed,
      },
      stats: {
        majorRoadCount: roadResult.stats.majorCount,
        minorRoadCount: roadResult.stats.minorCount,
        waterBodyCount: waterProcessed.features ? waterProcessed.features.length : 0,
        hasCoastline: coastlineRaw.length > 0,
        usedBboxFallback: coastlineRaw.length === 0,
      },
      warnings,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
