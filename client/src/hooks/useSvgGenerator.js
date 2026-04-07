import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { initProjection } from '../utils/projection';

export function useSvgGenerator() {
  const { state, dispatch } = useProject();

  const svgLayers = useMemo(() => {
    if (!state.layers || !state.bbox) return null;

    const { widthMm, heightMm } = state.settings.outputSize;
    // Convert mm to px at 96 DPI
    const MM_TO_PX = 3.7795275591;
    const outputWidthPx = widthMm * MM_TO_PX;
    const outputHeightPx = heightMm * MM_TO_PX;

    // Create bbox GeoJSON polygon
    const { south, west, north, east } = state.bbox;
    const bboxGeoJSON = {
      type: 'Polygon',
      coordinates: [[
        [west, south], [east, south], [east, north], [west, north], [west, south]
      ]]
    };

    // Initialize shared projection
    const { pathGenerator } = initProjection(bboxGeoJSON, outputWidthPx, outputHeightPx);

    // Store projection dimensions in context for export
    dispatch({
      type: 'SET_PROJECTION',
      payload: {
        projection: null,
        pathGenerator: null,
        outputWidthPx,
        outputHeightPx
      }
    });

    // Generate water paths (shared across all layers)
    const waterPaths = [];
    if (state.layers.water && state.layers.water.features) {
      state.layers.water.features.forEach(feature => {
        const d = pathGenerator(feature.geometry || feature);
        if (d) waterPaths.push(d);
      });
    }

    // Generate coastline/land path
    let landPath = '';
    if (state.layers.coastline) {
      const geom = state.layers.coastline.geometry || state.layers.coastline;
      landPath = pathGenerator(geom) || '';
    }

    // Combine land + water holes for Layer 3
    let basePath = landPath;
    if (waterPaths.length > 0) {
      basePath = landPath + ' ' + waterPaths.join(' ');
    }

    // Generate major road paths (Layer 1)
    const majorRoadPaths = [];
    if (state.layers.majorRoads && state.layers.majorRoads.features) {
      state.layers.majorRoads.features.forEach(feature => {
        const d = pathGenerator(feature.geometry || feature);
        if (d) majorRoadPaths.push(d);
      });
    }

    // Generate minor road paths (Layer 2)
    const minorRoadPaths = [];
    if (state.layers.minorRoads && state.layers.minorRoads.features) {
      state.layers.minorRoads.features.forEach(feature => {
        const d = pathGenerator(feature.geometry || feature);
        if (d) minorRoadPaths.push(d);
      });
    }

    // Registration marks
    const markInset = 8 * (outputWidthPx / widthMm);
    const markRadius = 1.5 * (outputWidthPx / widthMm);
    const registrationMarks = [
      { cx: markInset, cy: markInset },
      { cx: outputWidthPx - markInset, cy: markInset },
      { cx: markInset, cy: outputHeightPx - markInset },
      { cx: outputWidthPx - markInset, cy: outputHeightPx - markInset }
    ].map(m => ({ ...m, r: markRadius }));

    return {
      outputWidthPx,
      outputHeightPx,
      waterPaths,
      basePath,
      majorRoadPaths,
      minorRoadPaths,
      registrationMarks,
      landPath
    };
  }, [state.layers, state.bbox, state.settings.outputSize]);

  return svgLayers;
}
