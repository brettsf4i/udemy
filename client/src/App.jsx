import { ProjectProvider } from './context/ProjectContext';
import ToastProvider from './components/ToastProvider';
import StepIndicator from './components/StepIndicator';
import MapView from './components/MapView';
import PreviewPanel from './components/PreviewPanel';
import LayerControls from './components/LayerControls';
import CustomizePanel from './components/CustomizePanel';
import ExportButton from './components/ExportButton';

export default function App() {
  return (
    <ProjectProvider>
      <div className="h-screen w-screen flex bg-background text-primary overflow-hidden">
        {/* Left panel — Map */}
        <div className="flex-[6] min-w-0 h-full">
          <MapView />
        </div>

        {/* Right panel — Sidebar */}
        <div className="flex-[4] min-w-[360px] max-w-[520px] h-full flex flex-col border-l border-border bg-surface">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <h1 className="text-lg font-bold tracking-tight">
              Laser<span className="text-primary">Map</span> Studio
            </h1>
          </div>

          {/* Step indicator */}
          <StepIndicator />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <PreviewPanel />
            <div className="border-t border-border">
              <LayerControls />
            </div>
            <div className="border-t border-border">
              <CustomizePanel />
            </div>
          </div>

          {/* Pinned export button */}
          <ExportButton />
        </div>
      </div>
      <ToastProvider />
    </ProjectProvider>
  );
}
