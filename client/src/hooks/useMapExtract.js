import { useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import toast from 'react-hot-toast';

export function useMapExtract() {
  const { state, dispatch } = useProject();

  const extractMapData = useCallback(async () => {
    if (!state.bbox) {
      toast.error('Please draw a selection area on the map first');
      return null;
    }

    dispatch({
      type: 'SET_LOADING',
      payload: { isLoading: true, loadingMessage: 'Fetching map data...' }
    });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: state.bbox,
          settings: {
            outputSize: state.settings.outputSize,
            kerf: state.settings.kerf,
            roadDensity: state.settings.roadDensity,
            detailLevel: state.settings.detailLevel
          }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      dispatch({
        type: 'SET_LAYERS',
        payload: {
          layers: data.layers,
          stats: data.stats,
          warnings: data.warnings || []
        }
      });
      dispatch({ type: 'SET_STEP', payload: 3 });

      // Show warnings as toasts
      if (data.warnings) {
        data.warnings.forEach(w => toast(w, { icon: '\u26A0\uFE0F', duration: 5000 }));
      }

      toast.success('Map data loaded successfully');
      return data;
    } catch (err) {
      const message = err.message || 'Failed to fetch map data';
      dispatch({ type: 'SET_ERROR', payload: message });

      if (message.includes('too large')) {
        toast.error('Selection area too large \u2014 please zoom in and select a smaller region');
      } else if (message.includes('too small')) {
        toast.error('Selection area too small \u2014 please zoom out and select a larger region');
      } else {
        toast.error(message);
      }
      return null;
    } finally {
      dispatch({
        type: 'SET_LOADING',
        payload: { isLoading: false, loadingMessage: '' }
      });
    }
  }, [state.bbox, state.settings, dispatch]);

  return { extractMapData, isLoading: state.isLoading };
}
