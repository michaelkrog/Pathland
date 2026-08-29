import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VStack, Text, Border, Padding, Rounding } from '@apaq/ngui-elements/core';

/**
 * A temporary placeholder for protocol components the ngui design system does
 * not (yet) provide. It renders an ngui-styled "not implemented" tag so the
 * renderer stays a pure function of the opcode stream with no raw HTML.
 */
@Component({
  selector: 'pathland-not-implemented',
  imports: [VStack, Text, Border, Padding, Rounding],
  template: `
    <ui-vstack [padding]="pad" [border]="border" [rounding]="rounding">
      <ui-text [text]="name() + ' · not implemented'"></ui-text>
    </ui-vstack>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotImplementedComponent {
  readonly name = input<string>('');

  readonly pad = { paddingAreas: [{ edge: 'All' as const, gap: 8 }] };
  readonly border = { borderAreas: [{ side: 'All' as const, width: 1 }], color: '#d1d5db' };
  readonly rounding = { radius: 6 };
}