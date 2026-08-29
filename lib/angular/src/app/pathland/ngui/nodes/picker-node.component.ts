import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HStack } from '@apaq/ngui-elements/core';
import { Button, RadioGroup, Option } from '@apaq/ngui-elements/components';
import { Select } from '@apaq/ngui-elements/select';
import { PathlandNode } from '../../core/retained-tree';
import { PathlandNodeHost } from './node-host';
import { NotImplementedComponent } from '../not-implemented.component';
import { pickerStyle, selection, selectionString } from '../mapping';

/** Lazy `PICKER` node: select (menu) / segmented / radio group per `PICKER_STYLE`. */
@Component({
  selector: 'pathland-picker-node',
  imports: [HStack, Button, RadioGroup, Option, Select, NotImplementedComponent],
  template: `
    @let n = node();
    @if (n; as node) {
      @if (pickerStyle(node) === 'segmented') {
        <ui-hstack [gap]="4">
          @for (opt of options(node); track opt.index) {
            <ui-button
              [label]="selection(node) === opt.index ? opt.label + ' ✓' : opt.label"
              (click)="onIndex(nodeId(), opt.index)">
            </ui-button>
          }
        </ui-hstack>
      } @else if (pickerStyle(node) === 'radioGroup') {
        <ui-radio-group
          label=""
          [value]="selectionString(node)"
          (valueChange)="onSelect(nodeId(), $event)">
          @for (opt of options(node); track opt.index) {
            <div [option]="'' + opt.index">{{ opt.label }}</div>
          }
        </ui-radio-group>
      } @else if (pickerStyle(node) === 'wheel') {
        <pathland-not-implemented name="PICKER::Wheel" />
      } @else {
        <ui-select
          [value]="selectionString(node)"
          (valueChange)="onSelect(nodeId(), $event)">
          @for (opt of options(node); track opt.index) {
            <div [option]="'' + opt.index">{{ opt.label }}</div>
          }
        </ui-select>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickerNodeComponent extends PathlandNodeHost {
  pickerStyle = pickerStyle;
  selection = selection;
  selectionString = selectionString;

  onIndex(nodeId: number, index: number): void {
    this.session.sendValueChanged(nodeId, index);
  }

  onSelect(nodeId: number, value: string | undefined): void {
    if (value === undefined) {
      return;
    }
    this.session.sendValueChanged(nodeId, Number(value));
  }

  /** The picker's options: child node texts with their display order index. */
  options(n: PathlandNode): { index: number; label: string }[] {
    return n.children()
      .map((id) => this.session.tree.node(id))
      .filter((c): c is PathlandNode => c !== undefined)
      .map((c, index) => ({ index, label: c.text() ?? '' }));
  }
}