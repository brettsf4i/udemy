import { Download, Loader2 } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useMapExtract } from '../hooks/useMapExtract';
import { useExport } from '../hooks/useExport';

export default function ExportButton() {
  const { state } = useProject();
  const { extractMapData, isLoading: isExtracting } = useMapExtract();
  const { exportZip, isExporting } = useExport();

  const hasBbox = !!state.bbox;
  const hasLayers = !!state.layers;
  const isBusy = isExtracting || isExporting;

  const handleClick = () => {
    if (!hasLayers) {
      extractMapData();
    } else {
      exportZip();
    }
  };

  let buttonText = 'Draw a selection to continue';
  let buttonIcon = null;
  let disabled = true;

  if (!hasBbox) {
    buttonText = 'Draw a selection to continue';
    disabled = true;
  } else if (isBusy) {
    buttonText = state.loadingMessage || (isExporting ? 'Generating...' : 'Fetching map data...');
    buttonIcon = <Loader2 size={16} className="animate-spin" />;
    disabled = true;
  } else if (!hasLayers) {
    buttonText = 'Generate Preview';
    disabled = false;
  } else {
    buttonText = 'Download LaserMap Files';
    buttonIcon = <Download size={16} />;
    disabled = false;
  }

  const { widthMm, heightMm } = state.settings.outputSize;

  return (
    <div className="p-4 border-t border-border bg-surface">
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${
          disabled
            ? 'bg-surface-2 text-secondary cursor-not-allowed'
            : hasLayers
            ? 'bg-success hover:bg-success/90 text-white'
            : 'bg-primary hover:bg-primary-hover text-white'
        }`}
      >
        {buttonIcon}
        {buttonText}
      </button>
      {hasLayers && (
        <p className="text-[11px] text-secondary text-center mt-2">
          3 SVG files + assembly guide &bull; {state.cityName || 'City'} &bull; {widthMm}×{heightMm}mm
        </p>
      )}
    </div>
  );
}
