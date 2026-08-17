import React, { useEffect, useRef, useState } from 'react';

// Subtle count-up animation for premium number reveals.
// Animates from the previous value to the new one with an ease-out curve.
export default function CountUp({ value, format = (v) => v, duration = 700, className }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const from = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (target - from) * eased;
      setDisplay(cur);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}