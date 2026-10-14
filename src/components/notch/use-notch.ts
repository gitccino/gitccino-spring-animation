import * as React from "react";
import { NotchController } from "./notch-controller";
import type { NotchEngineOptions } from "./notch-engine";

export function useNotch(options: NotchEngineOptions) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const pillRef = React.useRef<HTMLDivElement | null>(null);
  const expandedRef = React.useRef<HTMLDivElement | null>(null);
  const controllerRef = React.useRef<NotchController | null>(null);
  if (controllerRef.current === null)
    controllerRef.current = new NotchController();

  // Stash latest options in a ref so callbacks always see fresh values
  //  without retriggering the attach effect.

  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  // React.useLayoutEffect(() => {
  //   optionsRef.current = options;
  // });

  const configKey = NotchController.serializeConfig(options);

  // Only create the new NotchEngine when configKey is changed
  React.useEffect(() => {
    const c = controllerRef.current!;
    if (containerRef.current && pillRef.current && expandedRef.current) {
      c.attach(
        {
          container: containerRef.current,
          pillEl: pillRef.current,
          expandedEl: expandedRef.current,
        },
        optionsRef.current,
      );
    }
    return () => c.destroy();
  }, [configKey]);

  const setState = React.useCallback((s: "pill" | "expanded") => {
    controllerRef.current?.setState(s);
  }, []);

  return { containerRef, pillRef, expandedRef, setState };
}
