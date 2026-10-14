import {
  NotchEngine,
  type NotchEngineOptions,
  type NotchState,
  type InternalRefs as AttachRefs,
} from "./notch-engine";

// interface AttachRefs {
//   container: HTMLElement;
//   pillEl: HTMLElement;
//   expandedEl: HTMLElement;
// }

export class NotchController {
  private instance: NotchEngine | null = null;
  private lastState: NotchState = "pill";
  private configKey = "";

  attach(refs: AttachRefs, options: NotchEngineOptions) {
    this.instance?.destroy();
    this.instance = new NotchEngine(refs, options);
    this.configKey = NotchController.serializeConfig(options);
    if (this.lastState === "expanded") this.instance.setState("expanded");
  }

  setState(state: NotchState) {
    this.lastState = state;
    this.instance?.setState(state);
  }

  setOptions(options: Partial<NotchEngineOptions>) {
    this.instance?.setOptions(options);
  }

  needsRecreate(options: NotchEngineOptions): boolean {
    return NotchController.serializeConfig(options) !== this.configKey;
  }

  destroy() {
    this.instance?.destroy();
    this.instance = null;
  }

  // static - this method belongs to the class itself, not to any instance
  static serializeConfig(o: NotchEngineOptions): string {
    const e = o.ease;
    const easeKey =
      typeof e === "object" && e !== null
        ? `s${e.stiffness}:d${e.damping}:m${e.mass}:p${e.precision}:a${e.alpha}`
        : String(e);
    const r = o.borderRadius;
    return [
      easeKey,
      o.duration,
      o.contentDelay,
      r?.pill,
      r?.expanded,
      o.respectReducedMotion,
    ].join("|");
  }
}
