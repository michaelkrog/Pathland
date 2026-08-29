import { computed, Directive, inject, input } from '@angular/core';
import { PathlandNode } from '../../core/retained-tree';
import { PathlandSession } from '../session.service';

/**
 * Shared host for the lazy per-kind node components: resolves the retained node
 * from the session tree by {@link nodeId}. Each subclass is a standalone
 * component loaded via `@defer (on immediate)` so its `@apaq/ngui` entry point
 * is only fetched when that kind actually appears in the tree.
 */
@Directive()
export abstract class PathlandNodeHost {
  readonly nodeId = input.required<number>();
  readonly session = inject(PathlandSession);
  readonly node = computed<PathlandNode | undefined>(() => this.session.tree.node(this.nodeId()));
}