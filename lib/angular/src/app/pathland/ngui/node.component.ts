import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  HStack, VStack, ZStack, Text, Image, ScrollView, SpacerComponent, Grid,
  Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame, LineLimit,
} from '@apaq/ngui-elements/core';
import { Button, Checkbox, Toggle } from '@apaq/ngui-elements/components';
import { TextField, TextFieldPrefix } from '@apaq/ngui-elements/text-field';
import { PROPERTY, COMPONENT } from '../core/protocol';
import { PathlandNode } from '../core/retained-tree';
import { PathlandSession } from './session.service';
import {
  buildMods, checked, colorFill, colorHex, dateValue, gaugePercent, hidden, imageSource, kindOf,
  progress, selection, shapeRadius, slider, stackAlignment, stackGap, stepper, textAlignment,
  toggleStyle, zstackAlignment,
} from './mapping';

/**
 * The recursive ngui renderer: one retained node → one `@apaq/ngui-elements`
 * view (+ modifiers). A pure function of the opcode stream — every value comes
 * from the retained tree, and nothing here is application state.
 */
@Component({
  selector: 'pathland-node',
  imports: [
    HStack, VStack, ZStack, Text, Image, ScrollView, SpacerComponent, Grid,
    Button, Checkbox, Toggle, TextField, TextFieldPrefix,
    Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame, LineLimit,
  ],
  templateUrl: './node.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathlandNodeComponent {
  readonly nodeId = input.required<number>();
  readonly session = inject(PathlandSession);

  readonly PROMPT = PROPERTY.PROMPT;
  readonly LABEL = PROPERTY.LABEL;

  nodeOf = (id: number): PathlandNode | undefined => this.session.tree.node(id);
  kindOf = kindOf;
  mods = buildMods;
  stackGap = stackGap;
  stackAlignment = stackAlignment;
  zstackAlignment = zstackAlignment;
  textAlignment = textAlignment;
  checked = checked;
  hidden = hidden;
  slider = slider;
  stepper = stepper;
  progress = progress;
  gaugePercent = gaugePercent;
  toggleStyle = toggleStyle;
  selection = selection;
  colorFill = colorFill;
  shapeRadius = shapeRadius;
  colorHex = colorHex;
  dateValue = dateValue;
  imageSource = imageSource;

  /** Whether the node must be ignored: `COMMENT` (opaque/debug, no native element). */
  ignored = (n: PathlandNode): boolean => n.component === COMPONENT.COMMENT;

  /** A slider's value change, routed back as a raw `VALUE_CHANGED` event. */
  onSliderInput(nodeId: number, event: Event): void {
    this.session.sendValueChanged(nodeId, Number((event.target as HTMLInputElement).value));
  }

  /** A toggle's boolean change → `VALUE_CHANGED` (0/1). */
  onToggleInput(nodeId: number, on: boolean): void {
    this.session.sendValueChanged(nodeId, on ? 1 : 0);
  }

  /** A stepper's `+`/`−` press → `VALUE_CHANGED` with the clamped next value. */
  onStepperInput(nodeId: number, dir: number): void {
    const node = this.nodeOf(nodeId);
    if (!node) {
      return;
    }
    const s = stepper(node);
    const next = Math.min(s.max, Math.max(s.min, s.value + dir * s.step));
    this.session.sendValueChanged(nodeId, next);
  }

  /** A picker's selected option index → `VALUE_CHANGED`. */
  onPickerInput(nodeId: number, event: Event): void {
    this.session.sendValueChanged(nodeId, Number((event.target as HTMLSelectElement).value));
  }

  /** A color picker's `#rrggbb` → `VALUE_CHANGED` with the packed ARGB bits. */
  onColorInput(nodeId: number, event: Event): void {
    const hex = (event.target as HTMLInputElement).value;
    if (!hex) {
      return;
    }
    this.session.sendValueBits(nodeId, 0xff000000 | parseInt(hex.slice(1), 16));
  }

  /** A date picker's `YYYY-MM-DD` → `DATE_CHANGED` (days since epoch). */
  onDateInput(nodeId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) {
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    const days = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
    this.session.sendDateChanged(nodeId, days, 0);
  }

  /** A text editor's value → `TEXT_CHANGED`. */
  onTextEditorInput(nodeId: number, event: Event): void {
    this.session.sendTextChanged(nodeId, (event.target as HTMLTextAreaElement).value);
  }

  /** A picker's options: child node texts with their display order index. */
  pickerOptions(n: PathlandNode): { index: number; label: string }[] {
    return n.children()
      .map((id) => this.nodeOf(id))
      .filter((c): c is PathlandNode => c !== undefined)
      .map((c, index) => ({ index, label: c.text() ?? '' }));
  }
}