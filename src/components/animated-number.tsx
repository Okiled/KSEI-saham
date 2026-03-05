import { useEffect, useRef, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
};

export function AnimatedNumber({
  value,
  duration = 1000,
  formatter = (n: number) => n.toLocaleString("id-ID"),
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const startTime = useRef<number | undefined>(undefined);
  const startValue = useRef(display);
  const rafId = useRef<number>(0);

  useEffect(() => {
    startValue.current = display;
    startTime.current = undefined;

    cancelAnimationFrame(rafId.current);

    const animate = (timestamp: number) => {
      if (startTime.current === undefined) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out expo
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = startValue.current + (value - startValue.current) * eased;

      setDisplay(current);
      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId.current);
  }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span>{formatter(display)}</span>;
}
