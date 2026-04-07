const { Router } = require('express');
const svgBuilder = require('../services/svgBuilder');
const zipBuilder = require('../services/zipBuilder');

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { layers, settings, bbox, cityName, customMessage } = req.body;

    if (!layers) {
      const err = new Error('layers is required');
      err.statusCode = 400;
      err.expose = true;
      throw err;
    }

    if (!settings || !settings.outputSize) {
      const err = new Error('settings.outputSize is required');
      err.statusCode = 400;
      err.expose = true;
      throw err;
    }

    if (!bbox) {
      const err = new Error('bbox is required');
      err.statusCode = 400;
      err.expose = true;
      throw err;
    }

    const { outputSize, kerf = 0.2 } = settings;
    const { widthMm, heightMm } = outputSize;

    // Generate all 3 SVG layer strings
    const svgLayers = await svgBuilder.buildAllLayers({
      layers,
      bbox,
      widthMm,
      heightMm,
      kerf,
      cityName: cityName || 'City',
      customMessage: customMessage || '',
    });

    // Generate README
    const readme = zipBuilder.generateReadme({
      cityName: cityName || 'City',
      widthMm,
      heightMm,
      kerf,
      stats: {
        majorRoads: layers.roads && layers.roads.major ? layers.roads.major.features.length : 0,
        minorRoads: layers.roads && layers.roads.minor ? layers.roads.minor.features.length : 0,
        waterFeatures: layers.water && layers.water.features ? layers.water.features.length : 0,
      },
    });

    // Build filename
    const safeCityName = (cityName || 'City').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${safeCityName}_LaserMap_${dateStr}.zip`;

    // Bundle into ZIP and stream response
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await zipBuilder.streamZip(res, {
      svgLayers,
      readme,
      cityName: safeCityName,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
