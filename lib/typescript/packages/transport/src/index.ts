/**
 * @pathland/transport
 * 
 * Transportation utilities for Pathland binary messages.
 * Provides abstractions for sending/receiving messages over various transports.
 */

import type { Command, DecodedMessage } from '@pathland/protocol';
import { encodeMessage, decodeMessage, BinaryReader, BinaryWriter } from '@pathland/protocol';

// ============================================
// MESSAGE SERIALIZATION
// ============================================

/**
 * Serialize a message to a transferable format.
 * For browser environments, this creates an ArrayBuffer that can be transferred.
 */
export function serializeMessage(commands: Command[]): ArrayBuffer {
  const buffer = encodeMessage(commands);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

/**
 * Deserialize a message from an ArrayBuffer or Uint8Array.
 */
export function deserializeMessage(buffer: ArrayBuffer | Uint8Array): DecodedMessage {
  if (buffer instanceof ArrayBuffer) {
    return decodeMessage(new Uint8Array(buffer));
  }
  return decodeMessage(buffer);
}

/**
 * Create a transferable object for posting messages.
 * Use with postMessage for zero-copy transfers.
 */
export function createTransferable(commands: Command[]): { message: ArrayBuffer; transferList: ArrayBuffer[] } {
  const buffer = encodeMessage(commands);
  return {
    message: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    transferList: [buffer.buffer as ArrayBuffer],
  };
}

// ============================================
// TRANSPORT INTERFACES
// ============================================

/**
 * Generic message handler.
 */
export type MessageHandler = (message: DecodedMessage) => void;

/**
 * Error handler for transport.
 */
export type TransportErrorHandler = (error: Error) => void;

/**
 * Transport interface.
 */
export interface Transport {
  /** Send a message */
  send(commands: Command[]): void;
  /** Send raw binary message */
  sendBinary(buffer: Uint8Array): void;
  /** Close the transport */
  close(): void;
  /** Subscribe to incoming messages */
  onMessage(handler: MessageHandler): () => void;
  /** Subscribe to errors */
  onError(handler: TransportErrorHandler): () => void;
}

// ============================================
// MEMORY TRANSPORT (for testing/in-process)
// ============================================

/**
 * In-memory transport for testing or same-process communication.
 */
export class MemoryTransport implements Transport {
  private handlers: Set<MessageHandler> = new Set();
  private errorHandlers: Set<TransportErrorHandler> = new Set();
  private otherEnd?: MemoryTransport;

  /**
   * Connect two memory transports together.
   */
  connect(other: MemoryTransport): void {
    this.otherEnd = other;
    other.otherEnd = this;
  }

  send(commands: Command[]): void {
    const buffer = encodeMessage(commands);
    this.sendBinary(buffer);
  }

  sendBinary(buffer: Uint8Array): void {
    if (this.otherEnd) {
      try {
        const message = decodeMessage(buffer);
        for (const handler of this.otherEnd.handlers) {
          handler(message);
        }
      } catch (e) {
        for (const handler of this.otherEnd.errorHandlers) {
          handler(e as Error);
        }
      }
    }
  }

  close(): void {
    this.handlers.clear();
    this.errorHandlers.clear();
    if (this.otherEnd) {
      this.otherEnd.otherEnd = undefined;
      this.otherEnd = undefined;
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onError(handler: TransportErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }
}

// ============================================
// BROWSER TRANSPORTS
// ============================================

/**
 * PostMessage transport for window/iframe communication.
 */
export class PostMessageTransport implements Transport {
  private handlers: Set<MessageHandler> = new Set();
  private errorHandlers: Set<TransportErrorHandler> = new Set();
  private target: Window;
  private origin: string;
  private closed: boolean = false;

  /**
   * Create a PostMessage transport.
   * @param target The target window to send messages to
   * @param origin The expected origin for security (use '*' for development only)
   */
  constructor(target: Window, origin: string = '*') {
    this.target = target;
    this.origin = origin;

    window.addEventListener('message', (event) => {
      if (this.closed) return;
      if (event.data?.pathlandMessage) {
        try {
          const message = deserializeMessage(event.data.pathlandMessage);
          for (const handler of this.handlers) {
            handler(message);
          }
        } catch (e) {
          for (const handler of this.errorHandlers) {
            handler(e as Error);
          }
        }
      }
    });
  }

  send(commands: Command[]): void {
    if (this.closed) return;
    const { message, transferList } = createTransferable(commands);
    this.target.postMessage({ pathlandMessage: message }, this.origin, transferList);
  }

  sendBinary(buffer: Uint8Array): void {
    if (this.closed) return;
    const { message, transferList } = createTransferable(
      decodeMessage(buffer).commands
    );
    this.target.postMessage({ pathlandMessage: message }, this.origin, transferList);
  }

  close(): void {
    this.closed = true;
    this.handlers.clear();
    this.errorHandlers.clear();
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onError(handler: TransportErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }
}

/**
 * WebSocket transport for server communication.
 */
export class WebSocketTransport implements Transport {
  private handlers: Set<MessageHandler> = new Set();
  private errorHandlers: Set<TransportErrorHandler> = new Set();
  private socket: WebSocket;
  private closed: boolean = false;

  /**
   * Create a WebSocket transport.
   * @param url The WebSocket URL to connect to
   * @param protocols Optional protocols for the WebSocket
   */
  constructor(url: string, protocols?: string | string[]) {
    this.socket = new WebSocket(url, protocols);

    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => {};

    this.socket.onmessage = (event) => {
      if (this.closed) return;
      try {
        if (typeof event.data === 'string') {
          // Handle base64 encoded messages if needed
        } else if (event.data instanceof ArrayBuffer) {
          const message = deserializeMessage(event.data);
          for (const handler of this.handlers) {
            handler(message);
          }
        }
      } catch (e) {
        for (const handler of this.errorHandlers) {
          handler(e as Error);
        }
      }
    };

    this.socket.onerror = (event) => {
      for (const handler of this.errorHandlers) {
        handler(new Error('WebSocket error'));
      }
    };

    this.socket.onclose = () => {
      this.closed = true;
    };
  }

  send(commands: Command[]): void {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) return;
    const buffer = encodeMessage(commands);
    this.socket.send(buffer);
  }

  sendBinary(buffer: Uint8Array): void {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(buffer);
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.socket.close();
      this.handlers.clear();
      this.errorHandlers.clear();
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onError(handler: TransportErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  get readyState(): number {
    return this.socket.readyState;
  }
}

// ============================================
// BUFFER UTILITIES
// ============================================

/**
 * Concatenate multiple Uint8Array buffers.
 */
export function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

/**
 * Split a buffer into chunks of a given size.
 */
export function splitBuffer(buffer: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Convert Uint8Array to base64 string.
 */
export function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(buffer)));
}

/**
 * Convert base64 string to Uint8Array.
 */
export function fromBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  return new Uint8Array(Array.from(binaryString).map(c => c.charCodeAt(0)));
}
