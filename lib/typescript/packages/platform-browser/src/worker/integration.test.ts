/**
 * @pathland/platform-browser
 *
 * Integration test for the worker architecture boundary.
 *
 * Simulates the two "threads" with an in-memory message channel:
 * - Worker side: a view tree is compiled and its commands are encoded via the
 *   binary protocol, transmitted, and decoded on the "main" side.
 * - Main side: decoded commands are executed by the renderer; a renderer event
 *   is dispatched back to the worker side, where the application's gesture
 *   handler runs and produces new commands that flow back to the main side.
 */

import { describe, it, expect, vi } from 'vitest';
import { encodeMessage, decodeMessage } from '@pathland/protocol';
import { VStack, Text, signal, initialRender, handleDispatchEvent } from '@pathland/view';
import type { Command } from '@pathland/protocol';

describe('worker boundary integration', () => {
  it('round-trips commands (worker -> main) and events (main -> worker)', async () => {
    // Message channel: binary buffers flowing worker -> main.
    const mainBatches: Command[][] = [];

    const count = signal(0);
    const root = VStack(
      Text(count.map(n => `Count: ${n}`)),
      Text('+').tapGesture(() => count.set(count.get() + 1))
    );

    // ---- Worker side ----
    const workerTransport = {
      send: (commands: Command[]) => {
        // Protocol-first boundary: encode, "transmit", decode on main.
        const buffer = encodeMessage(commands);
        mainBatches.push(decodeMessage(buffer).commands);
      },
      sendBinary: () => {},
      close: () => {},
      onMessage: () => () => {},
      onError: () => () => {},
    };
    initialRender(root, workerTransport);

    // Initial render produced CREATE_NODE commands on the main side.
    const initialCommands = mainBatches.flat();
    expect(initialCommands.some(c => c.opcode === 'CREATE_NODE')).toBe(true);

    // Locate the '+' node id from the decoded tree.
    const plusNode = initialCommands.find(
      c => c.opcode === 'CREATE_NODE' && (c.properties.get(0x000A) as any)?.value === '+'
    ) as Extract<Command, { opcode: 'CREATE_NODE' }> & { nodeId: number };
    expect(plusNode).toBeDefined();

    // ---- Main -> worker: renderer emits a click on the '+' node ----
    handleDispatchEvent(plusNode.nodeId, 0x04);

    // The gesture handler bumps the signal; the update flushes on a microtask
    // and flows back through the binary boundary.
    await new Promise(resolve => setTimeout(resolve, 0));

    const allCommands = mainBatches.flat();
    const update = allCommands.find(
      c => c.opcode === 'SET_PROPERTY' && (c.value as any)?.value === 'Count: 1'
    );
    expect(update).toBeDefined();
  });
});
