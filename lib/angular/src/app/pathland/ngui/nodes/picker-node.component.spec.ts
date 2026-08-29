import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { PickerNodeComponent } from './picker-node.component';
import { PathlandSession } from '../session.service';
import { RetainedTree } from '../../core/retained-tree';
import { decodeFrame, encodeBatch, StringSectionWriter } from '../../core/decoder';
import { Opcode } from '../../core/frame';
import { CATEGORY, TREE, STYLE, COMPONENT, PROPERTY, VALUE_TYPE } from '../../core/protocol';
import { f32Bits } from '../../core/event-encoder';

/**
 * Renders the lazy `PICKER` node against a real retained tree. Guards the
 * `[option]`/`ng-template` TemplateRef contract (NG0201) and the lazy
 * picker's ngui wiring. Runs under `ng test` (Angular builder over vitest).
 */
function treeWithPicker(): RetainedTree {
  const strings = new StringSectionWriter();
  const one = strings.push('One');
  const two = strings.push('Two');
  const ops = [
    new Opcode(CATEGORY.TREE, TREE.CREATE_NODE, 0, 1, COMPONENT.PICKER, 0),
    new Opcode(CATEGORY.STYLE, STYLE.SET_PROPERTY, 0, 1, (VALUE_TYPE.F32 << 16) | PROPERTY.PICKER_STYLE, f32Bits(0)),
    new Opcode(CATEGORY.STYLE, STYLE.SET_PROPERTY, 0, 1, (VALUE_TYPE.U32 << 16) | PROPERTY.SELECTION, 0),
    new Opcode(CATEGORY.TREE, TREE.CREATE_NODE, 0, 2, COMPONENT.TEXT, 0),
    new Opcode(CATEGORY.STYLE, STYLE.SET_TEXT, 0, 2, one, 0),
    new Opcode(CATEGORY.TREE, TREE.INSERT_CHILD, 0, 1, 2, -1),
    new Opcode(CATEGORY.TREE, TREE.CREATE_NODE, 0, 3, COMPONENT.TEXT, 0),
    new Opcode(CATEGORY.STYLE, STYLE.SET_TEXT, 0, 3, two, 0),
    new Opcode(CATEGORY.TREE, TREE.INSERT_CHILD, 0, 1, 3, -1),
  ];
  const tree = new RetainedTree();
  tree.applyFrame(decodeFrame(encodeBatch(ops, strings.toBytes())));
  return tree;
}

describe('PickerNodeComponent', () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView; ui-select's combobox calls it.
    Element.prototype.scrollIntoView ??= (() => undefined) as () => void;
  });

  it('renders a menu-style picker with its options without throwing', async () => {
    const tree = treeWithPicker();
    const fake = {
      tree,
      sendValueChanged: (): void => undefined,
      sendTextChanged: (): void => undefined,
      sendDateChanged: (): void => undefined,
    } as unknown as PathlandSession;

    await TestBed.configureTestingModule({
      imports: [PickerNodeComponent],
      providers: [{ provide: PathlandSession, useValue: fake }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PickerNodeComponent);
    fixture.componentRef.setInput('nodeId', 1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ui-select')).toBeTruthy();
  });
});