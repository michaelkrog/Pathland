import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame,
  Shadow, RotationEffect, Underline,
} from '@apaq/ngui-elements/core';
import { Button, Checkbox, Toggle } from '@apaq/ngui-elements/components';
import { PathlandNodeHost } from './node-host';
import { buildMods, checked, toggleStyle } from '../mapping';

/** Lazy `TOGGLE` node: switch / checkbox / button per the `TOGGLE_STYLE` token. */
@Component({
  selector: 'pathland-toggle-node',
  imports: [
    Button, Checkbox, Toggle,
    Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame,
    Shadow, RotationEffect, Underline,
  ],
  template: `
    @let n = node();
    @if (n; as node) {
      @let m = mods(node);
      @if (toggleStyle(node) === 'checkbox') {
        <ui-checkbox
          [label]="node.text() ?? ''"
          [checked]="checked(node)"
          [padding]="m.padding!"
          [color]="m.color!"
          [background]="m.background!"
          [border]="m.border!"
          [rounding]="m.rounding!"
          [opacity]="m.opacity!"
          [font]="m.font!"
          [frame]="m.frame!"
          [flex]="m.flex!"
          [shadow]="m.shadow!"
          [rotationEffect]="m.rotation!"
          [underline]="m.underline!"
          (checkedChange)="onToggle(nodeId(), $event)">
        </ui-checkbox>
      } @else if (toggleStyle(node) === 'button') {
        <ui-button
          [label]="(node.text() ?? '') + (checked(node) ? ' ✓' : '')"
          [padding]="m.padding!"
          [color]="m.color!"
          [background]="m.background!"
          [border]="m.border!"
          [rounding]="m.rounding!"
          [opacity]="m.opacity!"
          [font]="m.font!"
          [frame]="m.frame!"
          [flex]="m.flex!"
          [shadow]="m.shadow!"
          [rotationEffect]="m.rotation!"
          [underline]="m.underline!"
          (click)="onToggle(nodeId(), !checked(node))">
        </ui-button>
      } @else {
        <ui-toggle
          [label]="node.text() ?? ''"
          [value]="checked(node)"
          [padding]="m.padding!"
          [color]="m.color!"
          [background]="m.background!"
          [border]="m.border!"
          [rounding]="m.rounding!"
          [opacity]="m.opacity!"
          [font]="m.font!"
          [frame]="m.frame!"
          [flex]="m.flex!"
          [shadow]="m.shadow!"
          [rotationEffect]="m.rotation!"
          [underline]="m.underline!"
          (valueChange)="onToggle(nodeId(), $event)">
        </ui-toggle>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleNodeComponent extends PathlandNodeHost {
  mods = buildMods;
  checked = checked;
  toggleStyle = toggleStyle;

  onToggle(nodeId: number, on: boolean): void {
    this.session.sendValueChanged(nodeId, on ? 1 : 0);
  }
}