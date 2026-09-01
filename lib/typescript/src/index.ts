// The Pathland DOM renderer bootstrap. Hydrates the server-rendered DOM,
// connects to the WebSocket, applies PLPL deltas in place, and reports raw
// inputs back as host → guest EVENT batches. Bundle: dist/pathland-dom-renderer.js

import type { DomRenderer } from "./apply";
import { Transport } from "./transport";
import {
  encodeDateChanged,
  encodePointerUp,
  encodeTextChanged,
  encodeValueBits,
  encodeValueChanged,
} from "./events";

function boot(): void {
  const byId = new Map<number, Node>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-pathland-id]")) {
    byId.set(Number(el.getAttribute("data-pathland-id")), el);
  }
  const renderer: DomRenderer = { byId };
  const transport = new Transport({
    url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    renderer,
  });
  transport.start();

  // Buttons (and stepper +/− buttons) report a tap/step as an event.
  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target) {
      return;
    }
    const button = target.closest<HTMLElement>("button[data-pathland-id]");
    if (button && transport.open) {
      transport.send(encodePointerUp(Number(button.getAttribute("data-pathland-id"))));
      return;
    }
    const stepButton = target.closest<HTMLElement>(".pathland-stepper button[data-step]");
    if (stepButton && transport.open) {
      const stepper = stepButton.closest<HTMLElement>(".pathland-stepper[data-pathland-id]");
      if (stepper) {
        const id = Number(stepper.getAttribute("data-pathland-id"));
        const valueEl = stepper.querySelector("span");
        const rangeEl = stepper.querySelector<HTMLElement>(".pathland-stepper-range");
        const current = Number(valueEl ? valueEl.textContent : 0);
        const dir = Number(stepButton.getAttribute("data-step"));
        const min = Number(rangeEl?.getAttribute("data-min"));
        const max = Number(rangeEl?.getAttribute("data-max"));
        const step = Number(rangeEl?.getAttribute("data-step"));
        const next = Math.min(max, Math.max(min, current + dir * step));
        transport.send(encodeValueChanged(id, next));
      }
    }
  });

  // Toggles report boolean state, selects the option index, pickers raw values.
  document.addEventListener("change", (event) => {
    if (!transport.open) {
      return;
    }
    const target = event.target as Element | null;
    if (!target) {
      return;
    }
    const toggle = target.closest<HTMLElement>("label.pathland-toggle[data-pathland-id]");
    if (toggle) {
      const box = toggle.querySelector<HTMLInputElement>("input[type=checkbox]");
      transport.send(
        encodeValueChanged(Number(toggle.getAttribute("data-pathland-id")), box && box.checked ? 1 : 0),
      );
      return;
    }
    const select = target.closest<HTMLSelectElement>("select[data-pathland-id]");
    if (select) {
      transport.send(encodeValueChanged(Number(select.getAttribute("data-pathland-id")), Number(select.value)));
      return;
    }
    const color = target.closest<HTMLInputElement>("input[type=color][data-pathland-id]");
    if (color) {
      const rgb = parseInt(color.value.slice(1), 16);
      transport.send(encodeValueBits(Number(color.getAttribute("data-pathland-id")), 0xff000000 | rgb));
      return;
    }
    const date = target.closest<HTMLInputElement>("input[type=date][data-pathland-id]");
    if (date && date.value) {
      const parts = date.value.split("-").map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 1;
      const d = parts[2] ?? 1;
      const days = Math.round(Date.UTC(y, m - 1, d) / 86400000);
      transport.send(encodeDateChanged(Number(date.getAttribute("data-pathland-id")), days, 0));
    }
  });

  // Sliders report live while dragging; text fields/editors report live while typing.
  document.addEventListener("input", (event) => {
    if (!transport.open) {
      return;
    }
    const target = event.target as Element | null;
    if (!target) {
      return;
    }
    const slider = target.closest<HTMLInputElement>("input[type=range]");
    if (slider) {
      const label = slider.closest<HTMLElement>("label.pathland-slider[data-pathland-id]");
      if (label) {
        transport.send(encodeValueChanged(Number(label.getAttribute("data-pathland-id")), Number(slider.value)));
      }
      return;
    }
    const textarea = target.closest<HTMLTextAreaElement>("textarea[data-pathland-id]");
    if (textarea) {
      transport.send(encodeTextChanged(Number(textarea.getAttribute("data-pathland-id")), textarea.value));
      return;
    }
    const input = target.closest<HTMLInputElement>("input[type=text]");
    if (!input) {
      return;
    }
    const label = input.closest<HTMLElement>("label.pathland-textfield[data-pathland-id]");
    if (label) {
      transport.send(encodeTextChanged(Number(label.getAttribute("data-pathland-id")), input.value));
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}