import { Eye, EyeOff, Layers } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const layers = [
  {
    key: 'layer1',
    name: 'Major Roads',
    description: 'Cut through',
    color: '#3D1C02',
  },
  {
    key: 'layer2',
    name: 'Minor Roads',
    description: 'Engraved',
    color: '#C8A96E',
  },
  {
    key: 'layer3',
    name: 'Base',
    description: 'Land silhouette',
    color: '#1B4FD8',
  },
];

export default function LayerControls() {
  const { state, dispatch } = useProject();
  const { layerVisibility, explodedView, layers: layerData } = state;

  if (!layerData) return null;

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
        <Layers size={14} />
        Layers
      </h3>

      <div className="space-y-1">
        {layers.map((layer) => {
          const isVisible = layerVisibility[layer.key];
          return (
            <button
              key={layer.key}
              onClick={() => dispatch({ type: 'TOGGLE_LAYER', payload: layer.key })}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isVisible
                  ? 'bg-surface-2 hover:bg-surface-2/80'
                  : 'bg-transparent hover:bg-surface-2/40 opacity-50'
              }`}
            >
              {isVisible ? (
                <Eye size={14} className="text-primary flex-shrink-0" />
              ) : (
                <EyeOff size={14} className="text-secondary flex-shrink-0" />
              )}
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0 border border-border"
                style={{ backgroundColor: layer.color }}
              />
              <div className="text-left flex-1 min-w-0">
                <span className="text-sm text-primary">{layer.name}</span>
                <span className="text-xs text-secondary ml-2">{layer.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-secondary">Exploded View</span>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_EXPLODED' })}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              explodedView ? 'bg-primary' : 'bg-surface-2'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                explodedView ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );
}
