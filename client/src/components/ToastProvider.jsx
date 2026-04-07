import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1A1D27',
          color: '#F0F2FF',
          border: '1px solid #2E3247',
          borderRadius: '8px',
          fontSize: '14px',
        },
        success: {
          duration: 4000,
          style: { borderLeft: '4px solid #22C55E' },
          iconTheme: { primary: '#22C55E', secondary: '#1A1D27' },
        },
        error: {
          duration: 6000,
          style: { borderLeft: '4px solid #EF4444' },
          iconTheme: { primary: '#EF4444', secondary: '#1A1D27' },
        },
      }}
    />
  );
}
