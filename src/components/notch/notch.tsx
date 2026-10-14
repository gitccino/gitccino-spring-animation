import React from "react";
import type { NotchEngineOptions } from "./notch-engine";
import { useNotch } from "./use-notch";
import { cn } from "../../lib/utils";
import "./Notch.css";

export type NotchTrigger = "click" | "hover" | "manual";

export type NotchProps = NotchEngineOptions & {
  pill: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expaneded: boolean) => void;
  trigger?: NotchTrigger;
  className?: string;
  style?: React.CSSProperties;
};

export default function Notch({
  pill,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  trigger = "click",
  className,
  style,
  ...engineOptions
}: NotchProps) {
  const [internalExpanded, setInternalExpanded] =
    React.useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded! : internalExpanded;

  const { containerRef, pillRef, expandedRef, setState } =
    useNotch(engineOptions);

  // Push React state -> engine
  React.useEffect(() => {
    setState(expanded ? "expanded" : "pill");
  }, [expanded, setState]);

  const setExpanded = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  // Outside-click
  React.useEffect(() => {
    if (trigger !== "click" || !expanded) return;
    const onDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };

    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [trigger, expanded, setExpanded, containerRef]);

  const handlers: React.HTMLAttributes<HTMLDivElement> = {};
  if (trigger === "click") {
    handlers.onClick = () => setExpanded(!expanded);
  } else if (trigger === "hover") {
    handlers.onMouseEnter = () => setExpanded(true);
    handlers.onMouseLeave = () => setExpanded(false);
  }

  return (
    <div
      ref={containerRef}
      className={cn("notch", className)}
      style={style}
      role="region"
      aria-expanded={expanded}
      {...handlers}
    >
      <div ref={pillRef} className="notch-pill" aria-hidden={expanded}>
        {pill}
      </div>
      <div ref={expandedRef} className="notch-expanded" aria-hidden={!expanded}>
        {children}
      </div>
    </div>
  );
}
