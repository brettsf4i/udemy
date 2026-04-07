import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useSvgGenerator } from '../hooks/useSvgGenerator';

function LoadingSkeleton() {
  return (
    <div className="w-full h-[240px] rounded-lg overflow-hidden">
      <div className="w-full h-full bg-surface-2 animate-pulse flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-32 h-3 bg-border rounded mx-auto" />
          <div className="w-20 h-3 bg-border rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="w-full h-[240px] rounded-lg border border-dashed border-border flex items-center justify-center">
      <p className="text-sm text-secondary text-center px-4">
        Generate a preview to see your layers
      </p>
    </div>
  );
}

export default function PreviewPanel() {
  const { state } = useProject();
  const svgLayers = useSvgGenerator();

  const { layerVisibility, explodedView, isLoading } = state;

  const layerCount = useMemo(() => {
    let count = 0;
    if (layerVisibility.layer1) count++;
    if (layerVisibility.layer2) count++;
    if (layerVisibility.layer3) count++;
    return count;
  }, [layerVisibility]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary">Preview</h3>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!svgLayers) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary">Preview</h3>
        </div>
        <EmptyState />
      </div>
    );
  }

  const {
    outputWidthPx,
    outputHeightPx,
    waterPaths,
    basePath,
    majorRoadPaths,
    minorRoadPaths,
    registrationMarks,
    landPath,
  } = svgLayers;

  const aspectRatio = outputWidthPx / outputHeightPx;
  const containerWidth = 320;
  const containerHeight = 240;
  const scale =
    aspectRatio > containerWidth / containerHeight
      ? containerWidth / outputWidthPx
      : containerHeight / outputHeightPx;
  const svgW = outputWidthPx * scale;
  const svgH = outputHeightPx * scale;

  const explodeOffset = explodedView ? 12 : 0;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
          <Layers size={14} />
          Preview
        </h3>
        <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full font-medium">
          {layerCount} layers
        </span>
      </div>

      <div className="w-full h-[240px] bg-surface-2 rounded-lg flex items-center justify-center overflow-hidden">
        <svg
          width={svgW + (explodedView ? 48 : 0)}
          height={svgH + (explodedView ? 48 : 0)}
          viewBox={`0 0 ${outputWidthPx + (explodedView ? 48 / scale : 0)} ${outputHeightPx + (explodedView ? 48 / scale : 0)}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Layer 3 - Base (bottom) */}
          {layerVisibility.layer3 && (
            <g
              transform={`translate(${explodeOffset * 2 / scale}, ${explodeOffset * 2 / scale})`}
              style={explodedView ? { filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))' } : {}}
            >
              {/* Land silhouette fill */}
              {landPath && (
                <path d={landPath} fill="#1B4FD8" stroke="none" />
              )}
              {/* Water cutouts rendered on top to punch through */}
              {waterPaths.map((d, i) => (
                <path key={`w3-${i}`} d={d} fill="#0F1117" stroke="none" />
              ))}
              {/* Registration marks */}
              {registrationMarks.map((m, i) => (
                <circle
                  key={`r3-${i}`}
                  cx={m.cx}
                  cy={m.cy}
                  r={m.r}
                  stroke="#666"
                  strokeWidth="0.5"
                  fill="none"
                />
              ))}
            </g>
          )}

          {/* Layer 2 - Minor Roads (middle) */}
          {layerVisibility.layer2 && (
            <g
              transform={`translate(${explodeOffset / scale}, ${explodeOffset / scale})`}
              style={explodedView ? { filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))' } : {}}
            >
              {/* Wood background */}
              <rect
                x="0"
                y="0"
                width={outputWidthPx}
                height={outputHeightPx}
                fill="#C8A96E"
              />
              {/* Water cutouts */}
              {waterPaths.map((d, i) => (
                <path key={`w2-${i}`} d={d} fill="#1B4FD8" stroke="none" />
              ))}
              {/* Minor road engrave lines */}
              {minorRoadPaths.map((d, i) => (
                <path
                  key={`mr-${i}`}
                  d={d}
                  stroke="#8B6914"
                  strokeWidth="0.8"
                  fill="none"
                  opacity={0.7}
                />
              ))}
              {/* Registration marks */}
              {registrationMarks.map((m, i) => (
                <circle
                  key={`r2-${i}`}
                  cx={m.cx}
                  cy={m.cy}
                  r={m.r}
                  stroke="#666"
                  strokeWidth="0.5"
                  fill="none"
                />
              ))}
            </g>
          )}

          {/* Layer 1 - Major Roads (top) */}
          {layerVisibility.layer1 && (
            <g
              transform="translate(0,0)"
              style={explodedView ? { filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))' } : {}}
            >
              {/* Wood background */}
              <rect
                x="0"
                y="0"
                width={outputWidthPx}
                height={outputHeightPx}
                fill="#3D1C02"
              />
              {/* Water cutouts */}
              {waterPaths.map((d, i) => (
                <path key={`w1-${i}`} d={d} fill="#1B4FD8" stroke="none" />
              ))}
              {/* Major road cuts - show through to layer below */}
              {majorRoadPaths.map((d, i) => (
                <path key={`MR-${i}`} d={d} fill="#C8A96E" stroke="none" />
              ))}
              {/* Registration marks */}
              {registrationMarks.map((m, i) => (
                <circle
                  key={`r1-${i}`}
                  cx={m.cx}
                  cy={m.cy}
                  r={m.r}
                  stroke="#999"
                  strokeWidth="0.5"
                  fill="none"
                />
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
