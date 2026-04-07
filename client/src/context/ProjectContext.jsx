import { createContext, useContext, useReducer } from 'react';

const initialSettings = {
  outputSize: { widthMm: 300, heightMm: 300 },
  kerf: 0.2,
  roadDensity: 70,
  detailLevel: 'all',
  materialThickness: 3,
  customMessage: '',
  font: 'Playfair Display SC',
  includeLaserGuide: true
};

const initialState = {
  // Step tracking
  currentStep: 1,

  // Map/bbox
  bbox: null,
  cityName: '',

  // Settings
  settings: { ...initialSettings },

  // Layer data (GeoJSON from backend)
  layers: null,
  stats: null,
  warnings: [],

  // Projection
  projection: null,
  pathGenerator: null,

  // UI state
  isLoading: false,
  loadingMessage: '',
  error: null,

  // Preview
  layerVisibility: { layer1: true, layer2: true, layer3: true },
  explodedView: false
};

function projectReducer(state, action) {
  switch (action.type) {
    case 'SET_BBOX':
      return { ...state, bbox: action.payload };

    case 'SET_CITY_NAME':
      return { ...state, cityName: action.payload };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      };

    case 'SET_LAYERS':
      return {
        ...state,
        layers: action.payload.layers,
        stats: action.payload.stats,
        warnings: action.payload.warnings || []
      };

    case 'SET_PROJECTION':
      return {
        ...state,
        projection: action.payload.projection,
        pathGenerator: action.payload.pathGenerator,
        ...(action.payload.outputWidthPx !== undefined && {
          outputWidthPx: action.payload.outputWidthPx
        }),
        ...(action.payload.outputHeightPx !== undefined && {
          outputHeightPx: action.payload.outputHeightPx
        })
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.loadingMessage || ''
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'TOGGLE_LAYER':
      return {
        ...state,
        layerVisibility: {
          ...state.layerVisibility,
          [action.payload]: !state.layerVisibility[action.payload]
        }
      };

    case 'TOGGLE_EXPLODED':
      return { ...state, explodedView: !state.explodedView };

    case 'RESET':
      return {
        ...initialState,
        settings: { ...state.settings }
      };

    default:
      return state;
  }
}

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  return (
    <ProjectContext.Provider value={{ state, dispatch }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
