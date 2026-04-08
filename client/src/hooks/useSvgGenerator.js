import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { initProjection } from '../utils/projection';

export function useSvgGenerator() {
  const { state } = useProject();

  const svgLayers = useMemo(() => {
    if (!state.layers || !state.bbox) return null;

    const { widthMm, heightMm } = state.settings.outputSize;
    // Convert mm to px at 96 DPI
    const MM_TO_PX = 3.7795275591;
    const outputWidthPx = widthMm * MM_TO_PX;
    const outputHeightPx = heightMm * MM_TO_PX;

    // Pass bbox as { south, west, north, east } — initProjection converts it to
    // a MultiPoint internally to avoid d3-geo's spherical polygon winding ambiguity.
    const { pathGenerator } = initProjection(state.bbox, outputWidthPx, outputHeightPx);

    // Generate water paths (shared across all layers)
    const waterPaths = [];
    if (state.layers.water && state.layers.water.features) {
      state.layers.water.features.forEach(feature => {
        const d = pathGenerator(feature);
        if (d) waterPaths.push(d);
      });
    }

    // Generate coastline/land path
    let landPath = '';
    if (state.layers.coastline && state.layers.coastline.features) {
      state.layers.coastline.features.forEach(feature => {
        const d = pathGenerator(feature);
        if (d) landPath += (landPath ? ' ' : '') + d;
      });
    }
    // Fallback: full bbox rect
    if (!landPath) {
      landPath = `M0,0 L${outputWidthPx},0 L${outputWidthPx},${outputHeightPx} L0,${outputHeightPx} Z`;
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
        const d = pathGenerator(feature);
        if (d) majorRoadPaths.push(d);
      });
    }

    // Generate minor road paths (Layer 2)
    const minorRoadPaths = [];
    if (state.layers.minorRoads && state.layers.minorRoads.features) {
      state.layers.minorRoads.features.forEach(feature => {
        const d = pathGenerator(feature);
        if (d) minorRoadPaths.push(d);
      });
    }

    // Registration marks
    const markInset = 8 * MM_TO_PX;
    const markRadius = 1.5 * MM_TO_PX;
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
