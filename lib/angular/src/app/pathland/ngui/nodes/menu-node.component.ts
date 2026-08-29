import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HStack } from '@apaq/ngui-elements/core';
import { Button, Menu, Option } from '@apaq/ngui-elements/components';
import { TriggerFor } from '@apaq/ngui-elements/overlay';
import { PathlandNode } from '../../core/retained-tree';
import { PathlandNodeHost } from './node-host';

/** Lazy `MENU` node: trigger button + popup menu; selection reports `VALUE_CHANGED`. */
@Component({
  selector: 'pathland-menu-node',
  imports: [HStack, Button, Menu, Option, TriggerFor],
  template: `
    @let n = node();
    @if (n; as node) {
      <ui-hstack [gap]="0">
        <ui-button [triggerFor]="menu" [label]="triggerLabel(node)"></ui-button>
        <ui-menu #menu (onSelect)="onSelect(nodeId(), $event)">
          @for (opt of items(node); track opt.index) {
            <ng-template [option]="'' + opt.index">{{ opt.label }}</ng-template>
          }
        </ui-menu>
      </ui-hstack>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuNodeComponent extends PathlandNodeHost {
  onSelect(nodeId: number, value: string | undefined): void {
    if (value === undefined) {
      return;
    }
    this.session.sendValueChanged(nodeId, Number(value));
  }

  /** The menu's action items: children after the trigger, indexed from 0. */
  items(n: PathlandNode): { index: number; label: string }[] {
    return n.children()
      .slice(1)
      .map((id) => this.session.tree.node(id))
      .filter((c): c is PathlandNode => c !== undefined)
      .map((c, index) => ({ index, label: c.text() ?? '' }));
  }

  /** The menu's trigger label: the first child's text. */
  triggerLabel(n: PathlandNode): string {
    const trigger = n.children().length > 0 ? this.session.tree.node(n.children()[0]) : undefined;
    return trigger?.text() ?? 'Menu';
  }
}