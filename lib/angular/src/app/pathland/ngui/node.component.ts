import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  HStack, VStack, ZStack, Text, Image, ScrollView, SpacerComponent, Grid,
  Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame, LineLimit,
} from '@apaq/ngui-elements/core';
import { Button, Checkbox, Toggle, List } from '@apaq/ngui-elements/components';
import { TextField, TextFieldPrefix } from '@apaq/ngui-elements/text-field';
import { PROPERTY } from '../core/protocol';
import { PathlandNode } from '../core/retained-tree';
import { PathlandSession } from './session.service';
import {
  buildMods, checked, hidden, kindOf, slider, stackAlignment, stackGap, textAlignment,
  zstackAlignment,
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
    Button, Checkbox, Toggle, List, TextField, TextFieldPrefix,
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

  /** A slider's value change, routed back as a raw `VALUE_CHANGED` event. */
  onSliderInput(nodeId: number, event: Event): void {
    this.session.sendValueChanged(nodeId, Number((event.target as HTMLInputElement).value));
  }
}