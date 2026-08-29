import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  HStack, VStack, ZStack, Text, Image, ScrollView, SpacerComponent, Grid, Rectangle, Circle,
  Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame, LineLimit, ForegroundStyle,
  Shadow, RotationEffect, Underline,
} from '@apaq/ngui-elements/core';
import { COMPONENT, SHAPE_KIND } from '../core/protocol';
import { PathlandNode } from '../core/retained-tree';
import { PathlandSession } from './session.service';
import { NotImplementedComponent } from './not-implemented.component';
import { ButtonNodeComponent } from './nodes/button-node.component';
import { ToggleNodeComponent } from './nodes/toggle-node.component';
import { TextFieldNodeComponent } from './nodes/text-field-node.component';
import { TextEditorNodeComponent } from './nodes/text-editor-node.component';
import { PickerNodeComponent } from './nodes/picker-node.component';
import { MenuNodeComponent } from './nodes/menu-node.component';
import { DatePickerNodeComponent } from './nodes/date-picker-node.component';
import {
  buildMods, colorFill, hidden, imageSource, kindOf, shapeKind, stackAlignment, stackGap,
  textAlignment, zstackAlignment,
} from './mapping';

/**
 * The recursive ngui renderer driver. The `@apaq/ngui` **core** views (stacks,
 * grids, text, image, spacer, shapes, scroll view) are always needed and stay
 * eager; every **control** kind (button, toggle, text field/editor, picker,
 * menu, date picker) is rendered by a per-kind lazy node loaded via
 * `@defer (on immediate)` so its ngui entry point is only fetched when that
 * kind actually appears in the tree. Protocol components with no ngui
 * equivalent render a "not implemented" placeholder.
 */
@Component({
  selector: 'pathland-node',
  imports: [
    HStack, VStack, ZStack, Text, Image, ScrollView, SpacerComponent, Grid, Rectangle, Circle,
    Padding, Color, Background, Border, Rounding, Opacity, Font, Flex, Frame, LineLimit,
    ForegroundStyle, Shadow, RotationEffect, Underline,
    NotImplementedComponent,
    ButtonNodeComponent, ToggleNodeComponent, TextFieldNodeComponent, TextEditorNodeComponent,
    PickerNodeComponent, MenuNodeComponent, DatePickerNodeComponent,
  ],
  templateUrl: './node.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathlandNodeComponent {
  readonly nodeId = input.required<number>();
  readonly session = inject(PathlandSession);

  readonly SHAPE_KIND = SHAPE_KIND;

  nodeOf = (id: number): PathlandNode | undefined => this.session.tree.node(id);
  kindOf = kindOf;
  mods = buildMods;
  stackGap = stackGap;
  stackAlignment = stackAlignment;
  zstackAlignment = zstackAlignment;
  textAlignment = textAlignment;
  hidden = hidden;
  colorFill = colorFill;
  shapeKind = shapeKind;
  imageSource = imageSource;

  /** Whether the node must be ignored: `COMMENT` (opaque/debug, no native element). */
  ignored = (n: PathlandNode): boolean => n.component === COMPONENT.COMMENT;
}