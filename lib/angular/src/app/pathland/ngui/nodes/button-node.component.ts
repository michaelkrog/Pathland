import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame,
  Shadow, RotationEffect, Underline,
} from '@apaq/ngui-elements/core';
import { Button } from '@apaq/ngui-elements/components';
import { PathlandNodeHost } from './node-host';
import { buildMods } from '../mapping';

/** Lazy `BUTTON` node: rendered only when a button appears in the tree. */
@Component({
  selector: 'pathland-button-node',
  imports: [
    Button,
    Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame,
    Shadow, RotationEffect, Underline,
  ],
  template: `
    @let n = node();
    @if (n; as node) {
      @let m = mods(node);
      <ui-button
        [label]="node.text() ?? ''"
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
        (click)="session.sendPointerUp(nodeId())">
      </ui-button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonNodeComponent extends PathlandNodeHost {
  mods = buildMods;
}