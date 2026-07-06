/**
 * Pathland POC Application
 * 
 * Uses view package for creating UI.
 */

import { View, ViewNode, VStack, HStack, Text, Signal } from '@pathland/view';

// ============================================
// DEMO 1: Simple VStack with Text (semantic colors)
// ============================================

class Demo1 extends View {
  body(): ViewNode {
    return VStack(
      Text('Demo 1: Simple VStack'),
      Text('This demonstrates a vertical stack with semantic color tokens.')
    )
      .padding(16)
      .background(0xFF00FF9F);
  }
}

// ============================================
// DEMO 2: HStack with Spacer
// ============================================

class Demo2 extends View {
  body(): ViewNode {
    return VStack(
      Text('Demo 2: HStack with Spacer'),
      HStack(
        Text('Left'),
        Text('Right')
      )
        .spacing(16)
        .padding(16)
        .background(0xFF00FF9F)
    );
  }
}

// ============================================
// DEMO 3: Nested Stacks
// ============================================

class Demo3 extends View {
  body(): ViewNode {
    return VStack(
      Text('Demo 3: Nested Stacks'),
      VStack(
        HStack(
          Text('Top-Left'),
          Text('Top-Right')
        ).spacing(8),
        HStack(
          Text('Bottom-Left'),
          Text('Bottom-Right')
        ).spacing(8)
      )
        .spacing(8)
        .padding(16)
        .background(0xFF00FF9F)
    );
  }
}

// ============================================
// DEMO 4: Styled components
// ============================================

class Demo4 extends View {
  body(): ViewNode {
    return VStack(
      Text('Demo 4: Styled Components'),
      VStack(
        Text('Background Color').background('primary').padding(8),
        Text('Font Size').fontSize(24).padding(8),
        Text('Opacity').opacity(0.5).padding(8)
      )
        .spacing(8)
        .padding(16)
        .background(0xFF00FF9F)
    );
  }
}

// ============================================
// DEMO 5: Live Clock
// ============================================

class Demo5 extends View {
  private time = new Signal(new Date());
  private interval: number | null = null;

  constructor() {
    super();
    // Update time every second
    this.interval = window.setInterval(() => {
      this.time.set(new Date());
    }, 1000);
  }

  cleanup() {
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  }

  body(): ViewNode {
    return VStack(
      Text('Demo 5: Live Clock'),
      Text(this.time.map(d => d.toLocaleTimeString()))
        .fontSize(24)
        .fontWeight(600)
        .padding(16)
    )
      .padding(16)
      .background(0xFF00FF9F);
  }
}

// ============================================
// DEMO 6: Counter with Signals
// ============================================

class Demo6 extends View {
  private count = new Signal(0);

  body(): ViewNode {
    return VStack(
      Text('Demo 6: Counter with Signals'),
      Text(this.count.map(n => `Count: ${n}`))
        .fontSize(24)
        .padding(16),
      HStack(
        Text('-').tapGesture(() => this.count.set(this.count.get() - 1)).padding(8),
        Text('+').tapGesture(() => this.count.set(this.count.get() + 1)).padding(8)
      )
        .spacing(16)
        .padding(16)
        .background('primary')
    )
      .spacing(16)
      .padding(16)
      .background(0xFF00FF9F);
  }
}

// ============================================
// DEMO 7: Conditional Rendering
// ============================================

class Demo7 extends View {
  private visible = new Signal(true);

  body(): ViewNode {
    return VStack(
      Text('Demo 7: Conditional Rendering'),
      this.visible.get() ? 
        Text('I am visible!').background('success').padding(16) :
        Text('I am hidden!').background('error').padding(16),
      Text(this.visible.map(v => v ? 'Hide' : 'Show'))
        .tapGesture(() => this.visible.set(!this.visible.get()))
        .padding(8)
        .background('primary')
    )
      .spacing(16)
      .padding(16)
      .background(0xFF00FF9F);
  }
}

// ============================================
// DEMO 8: Event Handling
// ============================================

class Demo8 extends View {
  private clicked = new Signal(false);

  body(): ViewNode {
    return VStack(
      Text('Demo 8: Event Handling'),
      Text(this.clicked.map(c => c ? 'Clicked!' : 'Click the box below'))
        .padding(8),
      Text('Click Me')
        .tapGesture(() => this.clicked.set(true))
        .padding(16)
        .background('primary')
    )
      .spacing(16)
      .padding(16)
      .background(0xFF00FF9F);
  }
}

// ============================================
// MAIN APPLICATION
// ============================================

class POCApp extends View {
  body(): ViewNode {
    return VStack(
      Text('Pathland POC Demos').fontSize(28).fontWeight(700).padding(24),
      Demo1.make(),
      Demo2.make(),
      Demo3.make(),
      Demo4.make(),
      Demo5.make(),
      Demo6.make(),
      Demo7.make(),
      Demo8.make()
    )
      .spacing(16)
      .padding(16)
      .background(0xFFFF00FF);
  }
}

export { POCApp };
export default POCApp;
