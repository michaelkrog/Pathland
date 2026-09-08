import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log, logEnabled, setLogLevel } from "../src/log";

describe("log", () => {
  beforeEach(() => setLogLevel("debug"));
  afterEach(() => vi.restoreAllMocks());

  it("prefixes with the namespace and respects the level gate", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    setLogLevel("info");

    log.info("ws", "connected");
    log.debug("ws", "← recv detail", "…");

    expect(info).toHaveBeenCalledWith("[pathland:ws]", "connected");
    expect(debug).not.toHaveBeenCalled();
  });

  it("logs debug detail once the threshold is raised", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    setLogLevel("debug");

    log.debug("apply", "frame", 7);

    expect(debug).toHaveBeenCalledWith("[pathland:apply]", "frame", 7);
    expect(logEnabled("debug")).toBe(true);
  });

  it("logs without a namespace under the bare [pathland] prefix", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setLogLevel("warn");

    log.warn(undefined, "hello");

    expect(warn).toHaveBeenCalledWith("[pathland]", "hello");
  });

  it("defaults to info when no toggle is set", () => {
    setLogLevel("info");
    expect(logEnabled("info")).toBe(true);
    expect(logEnabled("debug")).toBe(false);
  });
});