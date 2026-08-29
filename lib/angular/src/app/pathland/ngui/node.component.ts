import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  HStack, VStack, ZStack, Text, Image, ScrollView, SpacerComponent, Grid, Rectangle, Circle,
  Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame, LineLimit, ForegroundStyle,
} from '@apaq/ngui-elements/core';
import { Button, Checkbox, Toggle, RadioGroup, Menu, Option } from '@apaq/ngui-elements/components';
import { Select } from '@apaq/ngui-elements/select';
import { DatePicker } from '@apaq/ngui-elements/date-picker';
import { TextArea } from '@apaq/ngui-elements/text-area';
import { TextField, TextFieldPrefix } from '@apaq/ngui-elements/text-field';
import { TriggerFor } from '@apaq/ngui-elements/overlay';
import { PROPERTY, COMPONENT, SHAPE_KIND } from '../core/protocol';
import { PathlandNode } from '../core/retained-tree';
import { PathlandSession } from './session.service';
import { NotImplementedComponent } from './not-implemented.component';
import {
  buildMods, checked, colorFill, datePickerMode, dateValue, hidden, imageSource, kindOf,
  pickerStyle, secure, selection, selectionString, shapeKind, stackAlignment, stackGap,
  textAlignment, toggleStyle, zstackAlignment,
} from './mapping';

/**
 * The recursive ngui renderer: one retained node → one `@apaq/ngui` view
 * (+ modifiers). A pure function of the opcode stream — every value comes from
 * the retained tree, and nothing here is application state. Protocol components
 * the ngui design system does not provide render as a "not implemented"
 * placeholder ({@link NotImplementedComponent}).
 */
@Component({
  selector: 'pathland-node',
  imports: [
    HStack, VStack, ZStack, Text, Image, ScrollView, SpacerComponent, Grid, Rectangle, Circle,
    Button, Checkbox, Toggle, RadioGroup, Menu, Option, Select, DatePicker, TextArea,
    TextField, TextFieldPrefix, TriggerFor,
Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame, LineLimit,
    ForegroundStyle,
    NotImplementedComponent,
  ],
  templateUrl: './node.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathlandNodeComponent {
  readonly nodeId = input.required<number>();
  readonly session = inject(PathlandSession);

  readonly PROMPT = PROPERTY.PROMPT;
  readonly LABEL = PROPERTY.LABEL;
  readonly SHAPE_KIND = SHAPE_KIND;

  nodeOf = (id: number): PathlandNode | undefined => this.session.tree.node(id);
  kindOf = kindOf;
  mods = buildMods;
  stackGap = stackGap;
  stackAlignment = stackAlignment;
  zstackAlignment = zstackAlignment;
  textAlignment = textAlignment;
  checked = checked;
  hidden = hidden;
  toggleStyle = toggleStyle;
  selection = selection;
  selectionString = selectionString;
  pickerStyle = pickerStyle;
  datePickerMode = datePickerMode;
  dateValue = dateValue;
  colorFill = colorFill;
  shapeKind = shapeKind;
  imageSource = imageSource;
  secure = secure;

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

  /** A segmented picker option picked by index → `VALUE_CHANGED`. */
  onPickerIndex(nodeId: number, index: number): void {
    this.session.sendValueChanged(nodeId, index);
  }

  /** A select/radio-group value change (`index` as string) → `VALUE_CHANGED`. */
  onSelectInput(nodeId: number, value: string | undefined): void {
    if (value === undefined) {
      return;
    }
    this.session.sendValueChanged(nodeId, Number(value));
  }

  /** A text editor's value → `TEXT_CHANGED`. */
  onTextAreaInput(nodeId: number, value: string): void {
    this.session.sendTextChanged(nodeId, value);
  }

  /** A date picker's `YYYY-MM-DD` → `DATE_CHANGED` (days since epoch). */
  onDatePickerInput(nodeId: number, value: string | undefined): void {
    if (!value) {
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    const days = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
    this.session.sendDateChanged(nodeId, days, 0);
  }

  /** A menu item picked by value (option index as string) → `VALUE_CHANGED`. */
  onMenuSelect(nodeId: number, value: string | undefined): void {
    if (value === undefined) {
      return;
    }
    this.session.sendValueChanged(nodeId, Number(value));
  }

  /** A picker's options: child node texts with their display order index. */
  pickerOptions(n: PathlandNode): { index: number; label: string }[] {
    return n.children()
      .map((id) => this.nodeOf(id))
      .filter((c): c is PathlandNode => c !== undefined)
      .map((c, index) => ({ index, label: c.text() ?? '' }));
  }

  /** A menu's action items: children after the trigger, indexed from 0. */
  menuOptions(n: PathlandNode): { index: number; label: string }[] {
    return n.children()
      .slice(1)
      .map((id) => this.nodeOf(id))
      .filter((c): c is PathlandNode => c !== undefined)
      .map((c, index) => ({ index, label: c.text() ?? '' }));
  }

  /** A menu's trigger label: the first child's text. */
  menuTriggerLabel(n: PathlandNode): string {
    const trigger = n.children().length > 0 ? this.nodeOf(n.children()[0]) : undefined;
    return trigger?.text() ?? 'Menu';
  }
}