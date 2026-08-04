import React, { useState, useEffect } from 'react';
import AskButton from './AskButton';
import AskModal from './AskModal';

export default function Ask() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <AskButton onClick={() => setOpen(true)} hidden={open} />
      <AskModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}