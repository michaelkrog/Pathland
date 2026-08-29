import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Frame, Shadow, RotationEffect, Underline } from '@apaq/ngui-elements/core';
import { TextArea } from '@apaq/ngui-elements/text-area';
import { PROPERTY } from '../../core/protocol';
import { PathlandNodeHost } from './node-host';
import { buildMods } from '../mapping';

/** Lazy `TEXT_EDITOR` node. */
@Component({
  selector: 'pathland-text-editor-node',
  imports: [TextArea, Frame, Shadow, RotationEffect, Underline],
  template: `
    @let n = node();
    @if (n; as node) {
      @let m = mods(node);
      <ui-text-area
        [value]="node.text() ?? ''"
        [placeholder]="node.strings().get(PROMPT)!"
        [frame]="m.frame!"
        [shadow]="m.shadow!"
        [rotationEffect]="m.rotation!"
        [underline]="m.underline!"
        (valueChange)="onInput(nodeId(), $event)">
      </ui-text-area>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextEditorNodeComponent extends PathlandNodeHost {
  readonly PROMPT = PROPERTY.PROMPT;
  mods = buildMods;

  onInput(nodeId: number, value: string): void {
    this.session.sendTextChanged(nodeId, value);
  }
}