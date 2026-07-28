import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const STORAGE_KEY = 'geometricBg';

export function getGeometricBgEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== 'false';
}

export default function GeometricBgToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(getGeometricBgEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('geometricBgChange', { detail: next }));
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      title={enabled ? 'Disable background animation' : 'Enable background animation'}
    >
      {enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
    </button>
  );
}
