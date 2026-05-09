'use client';

import { useCallback, useEffect, useState } from 'react';
import CommandPalette from '@/components/CommandPalette';

export default function CommandPaletteProvider() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform);
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return <CommandPalette open={open} onClose={handleClose} />;
}
