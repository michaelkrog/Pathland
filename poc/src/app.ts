/**
 * Pathland POC Application
 * 
 * Uses view package for creating UI.
 */

import { View, ViewNode, VStack, HStack, Text, signal, If, For, Switch } from '@pathland/view';

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
  private time = signal(new Date());
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
  private count = signal(0);

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
// DEMO 7: Conditional Rendering (using If)
// ============================================

class Demo7 extends View {
  private visible = signal(true);

  body(): ViewNode {
    return VStack(
      Text('Demo 7: Conditional Rendering'),
      If(this.visible,
        () => Text('I am visible!').background('success').padding(16)
      ),
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
// DEMO 8: For Loop - List Rendering
// ============================================

class Demo8 extends View {
  private items = signal(['Apple', 'Banana', 'Cherry']);
  private newItem = signal('');

  body(): ViewNode {
    return VStack(
      Text('Demo 8: For Loop - List Rendering'),
      For(
        this.items,
        (item, index) => HStack(
          Text(`${index + 1}.`),
          Text(item).padding(8)
        )
          .spacing(8)
          .padding(8)
          .background(0xFF00FF9F)
          .cornerRadius(4)
      ),
      HStack(
        Text('Add:'),
        Text(this.newItem.map(v => v || 'Type here...')).padding(8).background(0xFFFFFFEE),
        Text('+').tapGesture(() => {
          if (this.newItem.get().trim()) {
            this.items.set([...this.items.get(), this.newItem.get()]);
            this.newItem.set('');
          }
        }).padding(8).background('success')
      ).spacing(8).padding(8),
      HStack(
        Text('Remove Last').tapGesture(() => {
          const current = this.items.get();
          if (current.length > 0) {
            this.items.set(current.slice(0, -1));
          }
        }).padding(8).background('error')
      )
    )
      .spacing(16)
      .padding(16)
      .background(0xFF00FF9F);
  }
}

// ============================================
// DEMO 9: Switch - Multi-way Branch
// ============================================

class Demo9 extends View {
  private status = signal<'loading' | 'error' | 'success'>('loading');

  body(): ViewNode {
    return VStack(
      Text('Demo 9: Switch - Multi-way Branch'),
      Text('Current status:').padding(8),
      Switch(
        this.status,
        {
          loading: () => Text('Loading...').color('blue').fontSize(24),
          error: () => Text('Error occurred!').color('error').fontSize(24),
          success: () => Text('Success!').color('success').fontSize(24)
        }
      ),
      Text('').padding(16), // Spacer
      HStack(
        Text('Set Loading').tapGesture(() => this.status.set('loading')).padding(8).background(0x0000FFFF),
        Text('Set Error').tapGesture(() => this.status.set('error')).padding(8).background(0xFF0000FF),
        Text('Set Success').tapGesture(() => this.status.set('success')).padding(8).background(0x00FF00FF)
      ).spacing(8)
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
      Demo1.make()
      .border(1, 0x000000FF).cornerRadius(8),
      Demo2.make(),
      Demo3.make(),
      Demo4.make(),
      Demo5.make(),
      Demo6.make(),
      Demo7.make(),
      Demo8.make(),
      Demo9.make()
    )
      .spacing(16)
      .padding(16)
      .background(0xDFDFEFFF)
      .border(1, 0x000000FF)
      .cornerRadius(12);
  }
}

export { POCApp };
export default POCApp;
