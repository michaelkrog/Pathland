// WebSocket transport: connects to the server's `/ws`, applies each received
// PLPL batch to the DOM renderer, negotiates the protocol version, and reports
// raw-input events back. Reconnect/backoff live here; session-resync and
// frameCount gap handling are P3 (the module seam is the `onBatch` hook).

import type { Batch } from "./plpl";
import { ProtocolError, parseBatch } from "./plpl";
import { applyBatch, type DomRenderer } from "./apply";
import { encodeResync } from "./events";
import { VERSION } from "./constants";

export type TransportStatus = "connecting" | "open" | "reconnecting";

export interface TransportOptions {
  /** WebSocket URL, e.g. `ws://host/ws`. */
  url: string;
  /** The retained-node registry deltas are applied to. */
  renderer: DomRenderer;
  /** Invoked after a batch is successfully applied (P3: resync/frameCount hooks). */
  onBatch?: (batch: Batch) => void;
  onStatus?: (status: TransportStatus) => void;
  /** Injectable socket factory (tests). */
  createSocket?: (url: string) => WebSocket;
}

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30000;
const MAX_ATTEMPTS = 30;

// Numeric readyState (the WebSocket global may be absent in test environments).
const WS_OPEN = 1;

export class Transport {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private readonly options: TransportOptions;

  constructor(options: TransportOptions) {
    this.options = options;
  }

  /** Connect and stay connected (auto-reconnect with exponential backoff). */
  start(): void {
    this.stopped = false;
    this.connect();
  }

  /** Permanently close the socket and cancel reconnects. */
  stop(): void {
    this.stopped = true;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  get open(): boolean {
    return this.ws !== null && this.ws.readyState === WS_OPEN;
  }

  send(bytes: Uint8Array): void {
    if (this.open) {
      this.ws!.send(bytes);
    }
  }

  private connect(): void {
    const ws = this.options.createSocket
      ? this.options.createSocket(this.options.url)
      : new WebSocket(this.options.url);
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      // A reconnect means the client missed deltas while disconnected: request a
      // full snapshot (META::RESYNC). The first connect never does — the client
      // already has the whole UI from the SSR HTML.
      const reconnected = this.attempt > 0;
      this.attempt = 0;
      this.options.onStatus?.("open");
      if (reconnected) {
        this.send(encodeResync());
      }
    };
    ws.onmessage = (event) => this.handleMessage(event.data);
    ws.onerror = () => {
      // onclose always follows; nothing to do here.
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.stopped) {
        return;
      }
      this.options.onStatus?.("reconnecting");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.attempt >= MAX_ATTEMPTS) {
      return;
    }
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.attempt, MAX_DELAY_MS);
    this.attempt++;
    setTimeout(() => this.connect(), delay);
  }

  private handleMessage(data: unknown): void {
    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Blob) {
      void data.arrayBuffer().then((buffer) => this.handleMessage(buffer));
      return;
    } else {
      bytes = new Uint8Array(0);
    }
    let batch: Batch;
    try {
      batch = parseBatch(bytes);
    } catch (err) {
      if (err instanceof ProtocolError) {
        console.error("[pathland] rejected batch:", err.message);
        return;
      }
      throw err;
    }
    if (batch.version !== VERSION) {
      console.warn(`[pathland] protocol version ${batch.version} != ${VERSION}; reloading`);
      location.reload();
      return;
    }
    try {
      applyBatch(batch, this.options.renderer);
    } catch (err) {
      if (err instanceof ProtocolError) {
        console.error("[pathland] rejected delta:", err.message);
        return;
      }
      throw err;
    }
    this.options.onBatch?.(batch);
  }
}