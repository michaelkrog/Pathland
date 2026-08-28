import { Component, OnInit } from '@angular/core';
import { PathlandNodeComponent } from './pathland/ngui/node.component';
import { PathlandSession } from './pathland/ngui/session.service';

/**
 * The `@apaq/ngui` renderer host: connects to the Pathland `/ws` socket and
 * renders the retained tree with ngui views (a pure function of the opcode
 * stream — no application state lives here).
 */
@Component({
  selector: 'app-root',
  imports: [PathlandNodeComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  constructor(readonly session: PathlandSession) {}

  ngOnInit(): void {
    this.session.connect();
  }
}