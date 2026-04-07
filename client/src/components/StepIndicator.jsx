import { Search, MapPin, Sliders, Download, Check } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const steps = [
  { num: 1, label: 'Search', icon: Search },
  { num: 2, label: 'Select Area', icon: MapPin },
  { num: 3, label: 'Customize', icon: Sliders },
  { num: 4, label: 'Export', icon: Download },
];

export default function StepIndicator() {
  const { state } = useProject();
  const { currentStep } = state;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
      {steps.map((step, idx) => {
        const isComplete = currentStep > step.num;
        const isActive = currentStep === step.num;
        const Icon = isComplete ? Check : step.icon;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isComplete
                    ? 'bg-success/20 text-success'
                    : isActive
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-secondary'
                }`}
              >
                <Icon size={14} />
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive ? 'text-primary-light' : isComplete ? 'text-success' : 'text-secondary'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-8 h-px mx-1 mt-[-14px] ${
                  currentStep > step.num ? 'bg-success' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
