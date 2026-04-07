import { useState } from 'react';
import { Settings, Type, Ruler, Layers, Zap } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const SIZE_PRESETS = [
  { label: '200×200', w: 200, h: 200 },
  { label: '300×300', w: 300, h: 300 },
  { label: '400×400', w: 400, h: 400 },
];

const THICKNESS_OPTIONS = [3, 6, 9];

const FONTS = [
  { value: 'Playfair Display SC', label: 'Classic' },
  { value: 'Montserrat', label: 'Modern' },
  { value: 'Courier Prime', label: 'Mono' },
];

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5">
        <Icon size={12} />
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function CustomizePanel() {
  const { state, dispatch } = useProject();
  const { settings, stats } = state;
  const [customSize, setCustomSize] = useState(false);

  const updateSetting = (key, value) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
  };

  const updateOutputSize = (widthMm, heightMm) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: { outputSize: { widthMm, heightMm } },
    });
  };

  const isPresetActive = (w, h) =>
    !customSize && settings.outputSize.widthMm === w && settings.outputSize.heightMm === h;

  return (
    <div className="p-4 space-y-5">
      <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
        <Settings size={14} />
        Customize
      </h3>

      {/* Output Size */}
      <Section icon={Ruler} title="Output Size">
        <div className="flex gap-1.5">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setCustomSize(false);
                updateOutputSize(preset.w, preset.h);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                isPresetActive(preset.w, preset.h)
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-secondary hover:text-primary'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setCustomSize(true)}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              customSize
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-secondary hover:text-primary'
            }`}
          >
            Custom
          </button>
        </div>
        {customSize && (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={settings.outputSize.widthMm}
              onChange={(e) => updateOutputSize(parseInt(e.target.value) || 100, settings.outputSize.heightMm)}
              min={50}
              max={1000}
              className="w-full px-2 py-1.5 bg-surface-2 border border-border rounded text-sm text-primary focus:outline-none focus:border-primary"
            />
            <span className="text-secondary text-xs">×</span>
            <input
              type="number"
              value={settings.outputSize.heightMm}
              onChange={(e) => updateOutputSize(settings.outputSize.widthMm, parseInt(e.target.value) || 100)}
              min={50}
              max={1000}
              className="w-full px-2 py-1.5 bg-surface-2 border border-border rounded text-sm text-primary focus:outline-none focus:border-primary"
            />
            <span className="text-secondary text-xs whitespace-nowrap">mm</span>
          </div>
        )}
      </Section>

      {/* Material */}
      <Section icon={Layers} title="Material">
        <div>
          <label className="text-xs text-secondary mb-1 block">Thickness</label>
          <div className="flex gap-1.5">
            {THICKNESS_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => updateSetting('materialThickness', t)}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  settings.materialThickness === t
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-secondary hover:text-primary'
                }`}
              >
                {t}mm
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-secondary">Kerf Compensation</label>
            <span className="text-xs text-primary font-mono">{settings.kerf.toFixed(2)}mm</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={0.4}
            step={0.05}
            value={settings.kerf}
            onChange={(e) => updateSetting('kerf', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>0.10mm</span>
            <span>0.40mm</span>
          </div>
        </div>
      </Section>

      {/* Road Detail */}
      <Section icon={Settings} title="Road Detail">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-secondary">Density</label>
            <span className="text-xs text-primary font-mono">{settings.roadDensity}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.roadDensity}
            onChange={(e) => updateSetting('roadDensity', parseInt(e.target.value))}
            className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>Minimal</span>
            <span>Maximum detail</span>
          </div>
        </div>
        {stats && (
          <div className="flex gap-2">
            <span className="text-xs px-2 py-1 bg-surface-2 rounded text-secondary">
              Cut: <span className="text-primary font-medium">{stats.majorRoadCount}</span> roads
            </span>
            <span className="text-xs px-2 py-1 bg-surface-2 rounded text-secondary">
              Engrave: <span className="text-primary font-medium">{stats.minorRoadCount}</span> roads
            </span>
          </div>
        )}
      </Section>

      {/* Text */}
      <Section icon={Type} title="Text">
        <div>
          <label className="text-xs text-secondary mb-1 block">City Label</label>
          <input
            type="text"
            value={state.cityName}
            onChange={(e) => dispatch({ type: 'SET_CITY_NAME', payload: e.target.value })}
            placeholder="City name"
            className="w-full px-2 py-1.5 bg-surface-2 border border-border rounded text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-secondary">Custom Message</label>
            <span className="text-[10px] text-secondary">
              {(settings.customMessage || '').length}/40
            </span>
          </div>
          <input
            type="text"
            value={settings.customMessage}
            onChange={(e) => {
              if (e.target.value.length <= 40) {
                updateSetting('customMessage', e.target.value);
              }
            }}
            placeholder="e.g. Est. 2024"
            maxLength={40}
            className="w-full px-2 py-1.5 bg-surface-2 border border-border rounded text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs text-secondary mb-1.5 block">Font</label>
          <div className="flex gap-1.5">
            {FONTS.map((font) => (
              <button
                key={font.value}
                onClick={() => updateSetting('font', font.value)}
                className={`flex-1 py-2 text-xs rounded transition-colors ${
                  settings.font === font.value
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-secondary hover:text-primary'
                }`}
                style={{ fontFamily: font.value }}
              >
                {font.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Laser Settings */}
      <Section icon={Zap} title="Laser Settings">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.includeLaserGuide}
            onChange={(e) => updateSetting('includeLaserGuide', e.target.checked)}
            className="w-4 h-4 rounded border-border bg-surface-2 text-primary accent-primary"
          />
          <span className="text-xs text-secondary">Include laser settings guide in export</span>
        </label>
      </Section>
    </div>
  );
}
