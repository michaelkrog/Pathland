import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame,
  Shadow, RotationEffect, Underline,
} from '@apaq/ngui-elements/core';
import { TextField, TextFieldPrefix } from '@apaq/ngui-elements/text-field';
import { PROPERTY } from '../../core/protocol';
import { PathlandNodeHost } from './node-host';
import { NotImplementedComponent } from '../not-implemented.component';
import { buildMods, secure } from '../mapping';

/** Lazy `TEXT_FIELD` node (a secure field renders the "not implemented" placeholder). */
@Component({
  selector: 'pathland-text-field-node',
  imports: [
    TextField, TextFieldPrefix,
    Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame,
    Shadow, RotationEffect, Underline,
    NotImplementedComponent,
  ],
  template: `
    @let n = node();
    @if (n; as node) {
      @let m = mods(node);
      @if (secure(node)) {
        <pathland-not-implemented name="SecureField" />
      } @else {
        <ui-text-field
          [value]="node.text() ?? ''"
          [placeholder]="node.strings().get(PROMPT)!"
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
          (valueChange)="session.sendTextChanged(nodeId(), $event)">
          @if (node.strings().get(LABEL); as label) {
            <span prefix>{{ label }}</span>
          }
        </ui-text-field>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextFieldNodeComponent extends PathlandNodeHost {
  readonly PROMPT = PROPERTY.PROMPT;
  readonly LABEL = PROPERTY.LABEL;
  mods = buildMods;
  secure = secure;
}