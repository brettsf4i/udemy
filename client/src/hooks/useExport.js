import { useCallback, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import toast from 'react-hot-toast';

export function useExport() {
  const { state } = useProject();
  const [isExporting, setIsExporting] = useState(false);

  const exportZip = useCallback(async () => {
    if (!state.layers || !state.bbox) {
      toast.error('No map data to export \u2014 generate a preview first');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Building your files...');

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layers: state.layers,
          settings: {
            outputSize: state.settings.outputSize,
            kerf: state.settings.kerf,
            cityName: state.cityName || 'City',
            customMessage: state.settings.customMessage,
            font: state.settings.font,
            materialThickness: state.settings.materialThickness,
            includeLaserGuide: state.settings.includeLaserGuide,
            roadDensity: state.settings.roadDensity
          },
          bbox: state.bbox,
          stats: state.stats
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const cityName = (state.cityName || 'City').replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const filename = `${cityName}_LaserMap_${date}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Your LaserMap files are ready!', { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Export failed \u2014 please try again', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [state.layers, state.bbox, state.cityName, state.settings, state.stats]);

  return { exportZip, isExporting };
}
