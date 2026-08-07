/**
 * @pathland/view - Control Flow Tests
 * 
 * Simple standalone tests for If, For, and Switch control flow functions.
 * Run with: npx tsx src/control-flow.test.ts
 */

import { it } from 'vitest';
import { If, For, Switch, signal, commandQueue, initialRender, resetNodeIdCounter } from './index';
import { VStack, Text } from './components';

// ============================================
// TEST HELPERS
// ============================================

/**
 * Mock transport that collects commands
 */
class MockTransport {
  commands: any[] = [];
  
  send(commands: any[]): void {
    this.commands.push(...commands);
  }
  
  reset(): void {
    this.commands = [];
  }
  
  getCommands(): any[] {
    return this.commands;
  }
}

/**
 * Reset global state between tests
 */
function resetTestState(): void {
  resetNodeIdCounter();
  commandQueue.commands = [];
  commandQueue.flushScheduled = false;
  commandQueue.transport = null;
}

/**
 * Assertion helper
 */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}



// ============================================
// TEST RUNNER
// ============================================

interface TestCase {
  name: string;
  fn: () => void;
}

class TestSuite {
  tests: TestCase[] = [];
  private passed = 0;
  private failed = 0;
  
  add(name: string, fn: () => void): void {
    this.tests.push({ name, fn });
  }
  
  run(): void {
    console.log(`\nRunning ${this.tests.length} tests...\n`);
    
    for (const test of this.tests) {
      try {
        test.fn();
        console.log(`✓ ${test.name}`);
        this.passed++;
      } catch (error: any) {
        console.log(`✗ ${test.name}`);
        console.log(`  ${error.message}`);
        this.failed++;
      }
    }
    
    console.log(`\n${this.passed} passed, ${this.failed} failed\n`);
    if (this.failed > 0) process.exit(1);
  }
}

const suite = new TestSuite();

// ============================================
// IF TESTS
// ============================================

suite.add('If: should not render content when condition is initially false', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const condition = signal(false);
  const root = VStack(
    If(condition, () => Text("Conditional"))
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const createNodeCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  
  // Only VStack should be created
  assert(createNodeCommands.length === 1, 
    `Expected 1 CREATE_NODE, got ${createNodeCommands.length}`);
  assert(createNodeCommands[0].componentType === 0x0002, 
    `Expected VSTACK component type`);
});

suite.add('If: should render content when condition is initially true', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const condition = signal(true);
  const root = VStack(
    If(condition, () => Text("Conditional"))
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const createNodeCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  
  // Should have VStack + Text
  assert(createNodeCommands.length >= 2, 
    `Expected at least 2 CREATE_NODE, got ${createNodeCommands.length}`);
  
  const textNodeCreated = createNodeCommands.some(c => c.componentType === 0x0003);
  assert(textNodeCreated, `Expected Text node to be created`);
  
  const insertChildCommands = commands.filter(c => c.opcode === 'INSERT_CHILD');
  assert(insertChildCommands.length >= 1, 
    `Expected at least 1 INSERT_CHILD, got ${insertChildCommands.length}`);
});

suite.add('If: should remove content when condition changes from true to false', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const condition = signal(true);
  const root = VStack(
    If(condition, () => Text("Conditional"))
  );
  
  initialRender(root, transport);
  transport.reset();
  
  condition.set(false);
  commandQueue.flush();
  
  const commands = transport.getCommands();
  const deleteCommands = commands.filter(c => c.opcode === 'DELETE_NODE');
  
  assert(deleteCommands.length >= 1, 
    `Expected at least 1 DELETE_NODE, got ${deleteCommands.length}`);
});

suite.add('If: should recreate content when condition changes from false to true', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const condition = signal(false);
  const root = VStack(
    If(condition, () => Text("Conditional"))
  );
  
  initialRender(root, transport);
  transport.reset();
  
  condition.set(true);
  commandQueue.flush();
  
  const commands = transport.getCommands();
  const createCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  const textNodeCreated = createCommands.some(c => c.componentType === 0x0003);
  
  assert(textNodeCreated, `Expected Text node to be created`);
  
  const insertCommands = commands.filter(c => c.opcode === 'INSERT_CHILD');
  assert(insertCommands.length >= 1, 
    `Expected at least 1 INSERT_CHILD, got ${insertCommands.length}`);
});

suite.add('If: should work with plain boolean values', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const root = VStack(
    If(true, () => Text("Always shown")),
    If(false, () => Text("Never shown"))
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const createNodeCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  const textNodes = createNodeCommands.filter(c => c.componentType === 0x0003);
  
  assert(textNodes.length === 1, 
    `Expected exactly 1 Text node, got ${textNodes.length}`);
});

// ============================================
// FOR TESTS
// ============================================

suite.add('For: should render all items in array', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const items = signal(['A', 'B', 'C']);
  const root = VStack(
    For(items, (item) => Text(item))
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const createNodeCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  const textNodes = createNodeCommands.filter(c => c.componentType === 0x0003);
  
  assert(textNodes.length === 3, 
    `Expected exactly 3 Text nodes, got ${textNodes.length}`);
});

suite.add('For: should render nothing for empty array', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const items = signal<string[]>([]);
  const root = VStack(
    For(items, (item) => Text(item))
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const createNodeCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  
  assert(createNodeCommands.length === 1, 
    `Expected exactly 1 CREATE_NODE (VStack), got ${createNodeCommands.length}`);
  assert(createNodeCommands[0].componentType === 0x0002, 
    `Expected VSTACK component type`);
});

suite.add('For: should handle array changes by recreating nodes', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const items = signal(['A', 'B']);
  const root = VStack(
    For(items, (item) => Text(item))
  );
  
  initialRender(root, transport);
  transport.reset();
  
  items.set(['X', 'Y', 'Z']);
  commandQueue.flush();
  
  const commands = transport.getCommands();
  const deleteCommands = commands.filter(c => c.opcode === 'DELETE_NODE');
  const createCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  
  assert(deleteCommands.length >= 2, 
    `Expected at least 2 DELETE_NODE, got ${deleteCommands.length}`);
  assert(createCommands.length >= 3, 
    `Expected at least 3 CREATE_NODE, got ${createCommands.length}`);
});

suite.add('For: should work with plain arrays', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const items = ['A', 'B', 'C'];
  const root = VStack(
    For(items, (item) => Text(item))
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const textNodes = commands
    .filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  
  assert(textNodes.length === 3, 
    `Expected exactly 3 Text nodes, got ${textNodes.length}`);
});

// ============================================
// FOR DIFFING TESTS
// ============================================

suite.add('For: appending an item only creates the new node', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);

  const items = signal(['A', 'B']);
  const root = VStack(
    For(items, (item) => Text(item))
  );

  initialRender(root, transport);
  transport.reset();

  items.set(['A', 'B', 'C']);
  commandQueue.flush();

  const commands = transport.getCommands();
  const deletes = commands.filter(c => c.opcode === 'DELETE_NODE');
  const creates = commands.filter(c => c.opcode === 'CREATE_NODE');
  const inserts = commands.filter(c => c.opcode === 'INSERT_CHILD');

  assert(deletes.length === 0, `Expected 0 DELETE_NODE, got ${deletes.length}`);
  assert(creates.length === 1, `Expected 1 CREATE_NODE (for C), got ${creates.length}`);
  assert(inserts.length === 1, `Expected 1 INSERT_CHILD, got ${inserts.length}`);
  assert(inserts[0].index === 2, `Expected append at index 2, got ${inserts[0].index}`);
});

suite.add('For: removing the last item only deletes that node', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);

  const items = signal(['A', 'B', 'C']);
  const root = VStack(
    For(items, (item) => Text(item))
  );

  initialRender(root, transport);
  transport.reset();

  items.set(['A', 'B']);
  commandQueue.flush();

  const commands = transport.getCommands();
  const deletes = commands.filter(c => c.opcode === 'DELETE_NODE');
  const creates = commands.filter(c => c.opcode === 'CREATE_NODE');

  assert(deletes.length === 1, `Expected 1 DELETE_NODE (for C), got ${deletes.length}`);
  assert(creates.length === 0, `Expected 0 CREATE_NODE, got ${creates.length}`);
});

suite.add('For: setting an identical array produces no commands', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);

  const items = signal(['A', 'B']);
  const root = VStack(
    For(items, (item) => Text(item))
  );

  initialRender(root, transport);
  transport.reset();

  items.set(['A', 'B']); // new array, same item references
  commandQueue.flush();

  assert(transport.getCommands().length === 0, 'Expected no commands for an unchanged array');
});

suite.add('For: replacing an item deletes it and creates a new node at its index', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);

  const items = signal(['A', 'B']);
  const root = VStack(
    For(items, (item) => Text(item))
  );

  initialRender(root, transport);
  transport.reset();

  items.set(['A', 'X']);
  commandQueue.flush();

  const commands = transport.getCommands();
  const deletes = commands.filter(c => c.opcode === 'DELETE_NODE');
  const creates = commands.filter(c => c.opcode === 'CREATE_NODE');
  const inserts = commands.filter(c => c.opcode === 'INSERT_CHILD');

  assert(deletes.length === 1, `Expected 1 DELETE_NODE (for B), got ${deletes.length}`);
  assert(creates.length === 1, `Expected 1 CREATE_NODE (for X), got ${creates.length}`);
  assert(inserts.length === 1, `Expected 1 INSERT_CHILD, got ${inserts.length}`);
  assert(inserts[0].index === 1, `Expected insert at index 1, got ${inserts[0].index}`);
});

suite.add('For: reuses node ids for unchanged items', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);

  const items = signal(['A', 'B']);
  const root = VStack(
    For(items, (item) => Text(item))
  );

  initialRender(root, transport);
  const initial = transport.getCommands();
  const aNode = initial.find(
    c => c.opcode === 'CREATE_NODE' && (c.properties as any).get(0x000A)?.value === 'A'
  );
  assert(aNode, 'Expected node for A on initial render');

  transport.reset();
  items.set(['A', 'B', 'C']);
  commandQueue.flush();

  const after = transport.getCommands();

  // The update path emits text via SET_PROPERTY (separate from CREATE_NODE).
  const aRecreated = after.find(
    c =>
      (c.opcode === 'CREATE_NODE' && (c.properties as any)?.get?.(0x000A)?.value === 'A') ||
      (c.opcode === 'SET_PROPERTY' && c.propertyId === 0x000A && (c.value as any)?.value === 'A')
  );
  assert(!aRecreated, 'A should not be recreated on append');

  const cSet = after.find(
    c => c.opcode === 'SET_PROPERTY' && c.propertyId === 0x000A && (c.value as any)?.value === 'C'
  );
  assert(cSet && cSet.nodeId !== aNode.nodeId, 'C should get a fresh node id');
});

suite.add('padding(top,right,bottom,left) emits per-edge SET_PROPERTY commands', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);

  const root = Text('Hi').padding(1, 2, 3, 4);
  initialRender(root, transport);

  const commands = transport.getCommands();
  const paddings = commands.filter(
    c => c.opcode === 'SET_PROPERTY' && [0x1012, 0x1013, 0x1014, 0x1015].includes(c.propertyId)
  );
  assert(paddings.length === 4, `Expected 4 per-edge padding commands, got ${paddings.length}`);
  assert(paddings.some(c => c.propertyId === 0x1012 && c.value.value === 1), 'expected top=1');
  assert(paddings.some(c => c.propertyId === 0x1013 && c.value.value === 2), 'expected right=2');
  assert(paddings.some(c => c.propertyId === 0x1014 && c.value.value === 3), 'expected bottom=3');
  assert(paddings.some(c => c.propertyId === 0x1015 && c.value.value === 4), 'expected left=4');
});

// ============================================
// SWITCH TESTS
// ============================================

suite.add('Switch: should render matching case', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const status = signal('loading');
  const root = VStack(
    Switch(status, {
      loading: () => Text("Loading..."),
      error: () => Text("Error!"),
      success: () => Text("Done!")
    })
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const textNodes = commands
    .filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  
  assert(textNodes.length === 1, 
    `Expected exactly 1 Text node, got ${textNodes.length}`);
});

suite.add('Switch: should render default case with _ key', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const status = signal('unknown');
  const root = VStack(
    Switch(status, {
      loading: () => Text("Loading..."),
      _: () => Text("Unknown")
    })
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const textNodes = commands
    .filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  
  assert(textNodes.length === 1, 
    `Expected exactly 1 Text node (default), got ${textNodes.length}`);
});

suite.add('Switch: should render default case with default key', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const status = signal('unknown');
  const root = VStack(
    Switch(status, {
      loading: () => Text("Loading..."),
      default: () => Text("Unknown")
    })
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const textNodes = commands
    .filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  
  assert(textNodes.length === 1, 
    `Expected exactly 1 Text node (default), got ${textNodes.length}`);
});

suite.add('Switch: should update when signal changes', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const status = signal('loading');
  const root = VStack(
    Switch(status, {
      loading: () => Text("Loading..."),
      error: () => Text("Error!"),
      success: () => Text("Done!")
    })
  );
  
  initialRender(root, transport);
  transport.reset();
  
  status.set('error');
  commandQueue.flush();
  
  const commands = transport.getCommands();
  const deleteCommands = commands.filter(c => c.opcode === 'DELETE_NODE');
  const createCommands = commands.filter(c => c.opcode === 'CREATE_NODE');
  
  assert(deleteCommands.length >= 1, 
    `Expected at least 1 DELETE_NODE, got ${deleteCommands.length}`);
  assert(createCommands.length >= 1, 
    `Expected at least 1 CREATE_NODE, got ${createCommands.length}`);
});

suite.add('Switch: should handle numeric values', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const count = signal(0);
  const root = VStack(
    Switch(count, {
      0: () => Text("Zero"),
      1: () => Text("One"),
      _: () => Text("Many")
    })
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const textNodes = commands
    .filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  
  assert(textNodes.length === 1, 
    `Expected exactly 1 Text node, got ${textNodes.length}`);
});

// ============================================
// INTEGRATION TESTS
// ============================================

suite.add('Integration: nested control flow', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const showDetails = signal(true);
  const items = signal(['A', 'B']);
  
  const root = VStack(
    If(showDetails, () =>
      For(items, (item) => Text(item))
    )
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const textNodes = commands
    .filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  
  assert(textNodes.length === 2, 
    `Expected exactly 2 Text nodes (A and B), got ${textNodes.length}`);
});

suite.add('Integration: multiple control flows in same container', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const cond1 = signal(true);
  const cond2 = signal(false);
  
  const root = VStack(
    If(cond1, () => Text("First")),
    If(cond2, () => Text("Second")),
    Text("Third")
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const textNodes = commands
    .filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  
  assert(textNodes.length === 2, 
    `Expected exactly 2 Text nodes (First and Third), got ${textNodes.length}`);
});

// ============================================
// SWITCH TESTS
// ============================================

suite.add('Switch - initial render with loading state', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  // Test that Switch initial render shows the correct case
  const status = signal<'loading' | 'error' | 'success'>('loading');
  
  const root = VStack(
    Switch(status, {
      loading: () => Text('Loading...').color('blue'),
      error: () => Text('Error!').color('red'),
      success: () => Text('Success!').color('green')
    })
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  
  // Should have CREATE_NODE for VStack
  const vstackNodes = commands.filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0002);
  assert(vstackNodes.length >= 1, `Expected at least 1 VStack node, got ${vstackNodes.length}`);
  
  // Should have CREATE_NODE for Text with "Loading..."
  const textNodes = commands.filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  assert(textNodes.length >= 1, `Expected at least 1 Text node, got ${textNodes.length}`);
  
  // Should have INSERT_CHILD commands connecting the Text to the VStack
  const insertCommands = commands.filter(c => c.opcode === 'INSERT_CHILD');
  assert(insertCommands.length >= 1, `Expected at least 1 INSERT_CHILD command, got ${insertCommands.length}`);
  
  // The Text content is carried as an inline property on CREATE_NODE
  // (the protocol allows initial property values to avoid separate SET_PROPERTY).
  const loadingTextNodes = commands.filter(
    (c: any) => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003 && c.properties?.get(0x000A)?.value === 'Loading...'
  );
  assert(loadingTextNodes.length >= 1,
    `Expected at least 1 CREATE_NODE with inline text 'Loading...', got ${loadingTextNodes.length}`);
});

suite.add('Switch - initial render with error state', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const status = signal<'loading' | 'error' | 'success'>('error');
  
  const root = VStack(
    Switch(status, {
      loading: () => Text('Loading...'),
      error: () => Text('Error occurred!'),
      success: () => Text('Success!')
    })
  );
  
  initialRender(root, transport);
  
  const commands = transport.getCommands();
  const errorTextNodes = commands.filter(
    (c: any) => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003 && c.properties?.get(0x000A)?.value === 'Error occurred!'
  );
  assert(errorTextNodes.length >= 1,
    `Expected at least 1 CREATE_NODE with inline text 'Error occurred!', got ${errorTextNodes.length}`);
});

suite.add('Switch - value change updates rendered content', () => {
  resetTestState();
  const transport = new MockTransport();
  commandQueue.setTransport(transport);
  
  const status = signal<'loading' | 'error'>('loading');
  
  const root = VStack(
    Switch(status, {
      loading: () => Text('Loading...'),
      error: () => Text('Error!')
    })
  );
  
  initialRender(root, transport);
  
  // Change from loading to error
  status.set('error');
  
  // Need to flush the command queue
  // In real usage, this would be done by the microtask queue
  // For testing, we need to manually flush
  commandQueue.flush();
  
  const commands = transport.getCommands();
  
  // Should have DELETE_NODE for the Loading... text
  const deleteCommands = commands.filter(c => c.opcode === 'DELETE_NODE');
  assert(deleteCommands.length >= 1, `Expected at least 1 DELETE_NODE command, got ${deleteCommands.length}`);
  
  // Should have CREATE_NODE for the Error! text
  const textNodes = commands.filter(c => c.opcode === 'CREATE_NODE' && c.componentType === 0x0003);
  assert(textNodes.length >= 2, `Expected at least 2 Text nodes (initial + update), got ${textNodes.length}`);
  
  // Should have SET_PROPERTY for Error! text
  const setPropertyCommands = commands.filter((c: any) => c.opcode === 'SET_PROPERTY');
  const errorTextCommands = setPropertyCommands.filter(
    (c: any) => c.propertyId === 0x000A && c.value && c.value.value === 'Error!'
  );
  assert(errorTextCommands.length >= 1, 
    `Expected at least 1 SET_PROPERTY with text 'Error!', got ${errorTextCommands.length}`);
});

// ============================================
// RUN TESTS
// ============================================

// Register each test case with vitest (globals are enabled in vitest.config.ts).
for (const test of suite.tests) {
  it(test.name, test.fn);
}
