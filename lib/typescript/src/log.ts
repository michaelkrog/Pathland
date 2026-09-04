// A tiny, dependency-free logger (zero runtime deps by contract). Levels +
// namespaces + an opt-in runtime toggle, so debug-level opcode/event detail is
// invisible by default and enabled with `window.__PATHLAND_LOG_LEVEL = "debug"`
// (or `?pathland-log=debug`) before the bundle loads.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function configuredLevel(): LogLevel {
  const g = globalThis as { __PATHLAND_LOG_LEVEL?: string };
  const param =
    typeof location !== "undefined" ? new URLSearchParams(location.search).get("pathland-log") : null;
  const raw = g.__PATHLAND_LOG_LEVEL ?? param;
  return (raw as LogLevel) in LEVELS ? (raw as LogLevel) : "info";
}

let level: number = LEVELS[configuredLevel()];

/** Raise/lower the logging threshold at runtime. */
export function setLogLevel(next: LogLevel): void {
  level = LEVELS[next];
}

/** Current level, e.g. to branch on expensive-to-format detail. */
export function logEnabled(threshold: LogLevel): boolean {
  return level <= LEVELS[threshold];
}

function fmt(ns: string | undefined): string {
  return `[pathland${ns ? ":" + ns : ""}]`;
}

/** Namespaced console logging (`[pathland:ws]`, `[pathland:route]`, …). */
export const log = {
  debug: (ns: string | undefined, ...args: unknown[]): void => {
    if (level <= LEVELS.debug) console.debug(fmt(ns), ...args);
  },
  info: (ns: string | undefined, ...args: unknown[]): void => {
    if (level <= LEVELS.info) console.info(fmt(ns), ...args);
  },
  warn: (ns: string | undefined, ...args: unknown[]): void => {
    if (level <= LEVELS.warn) console.warn(fmt(ns), ...args);
  },
  error: (ns: string | undefined, ...args: unknown[]): void => {
    if (level <= LEVELS.error) console.error(fmt(ns), ...args);
  },
};