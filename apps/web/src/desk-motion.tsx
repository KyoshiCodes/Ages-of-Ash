/** Shared Motion policy: reduced-motion and speed zero disable every authored animation. */
import { useEffect, useRef, useState } from "react";
import { animate, MotionConfig, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useDeskPreferences } from "./desk-preferences.ts";
export function DeskMotion({ children }: { children: ReactNode }) {
  const speed = useDeskPreferences((s) => s.speed),
    reduced = useReducedMotion();
  return (
    <MotionConfig
      reducedMotion={reduced || !speed ? "always" : "user"}
      transition={{ duration: reduced || !speed ? 0 : 0.22 / speed }}
    >
      <div
        className={!speed || reduced ? "motion-off" : "motion-on"}
        style={
          {
            "--motion-duration": `${!speed || reduced ? 0 : 0.22 / speed}s`,
            "--ambient-duration": `${speed ? 12 / speed : 0}s`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </MotionConfig>
  );
}
export function Reveal({ children, id }: { children: ReactNode; id: string }) {
  const speed = useDeskPreferences((s) => s.speed),
    reduced = useReducedMotion();
  return (
    <motion.div
      key={id}
      initial={reduced || !speed ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {children}
    </motion.div>
  );
}
export function Rollup({ value }: { value: number }) {
  const previous = useRef(value),
    [display, setDisplay] = useState(value),
    speed = useDeskPreferences((s) => s.speed),
    reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !speed) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.32 / speed,
      onUpdate: (n) => setDisplay(Math.round(n)),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduced, speed]);
  return (
    <span aria-label={value.toLocaleString()}>{display.toLocaleString()}</span>
  );
}
