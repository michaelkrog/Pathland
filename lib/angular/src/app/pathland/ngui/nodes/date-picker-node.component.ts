import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DatePicker } from '@apaq/ngui-elements/date-picker';
import { PathlandNodeHost } from './node-host';
import { NotImplementedComponent } from '../not-implemented.component';
import { datePickerMode, dateValue } from '../mapping';

/** Lazy `DATE_PICKER` node (DATE mode); Time/DateAndTime modes are placeholders. */
@Component({
  selector: 'pathland-date-picker-node',
  imports: [DatePicker, NotImplementedComponent],
  template: `
    @let n = node();
    @if (n; as node) {
      @if (datePickerMode(node) === 'date') {
        <ui-date-picker
          [value]="dateValue(node)"
          (valueChange)="onDate(nodeId(), $event)">
        </ui-date-picker>
      } @else if (datePickerMode(node) === 'time') {
        <pathland-not-implemented name="DATE_PICKER::Time" />
      } @else {
        <pathland-not-implemented name="DATE_PICKER::DateAndTime" />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePickerNodeComponent extends PathlandNodeHost {
  datePickerMode = datePickerMode;
  dateValue = dateValue;

  onDate(nodeId: number, value: string | undefined): void {
    if (!value) {
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    const days = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
    this.session.sendDateChanged(nodeId, days, 0);
  }
}