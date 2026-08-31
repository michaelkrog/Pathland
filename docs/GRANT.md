# Pathland — Grant Proposal Working Document

**Status:** Draft — raw material for an NLnet / NGI ("Open Internet Stack") proposal
**Date:** 2026-08-31
**Intended fund:** NLnet — new Open Internet Stack funds (reopen **Sept 3, 2026**, deadline **Nov 3, 2026**)
**Applying entity:** Company / legal entity (TBD — verify eligibility against the specific fund when the call opens)

This document is the working source for the NLnet application form. It is not
the submission itself — every section maps 1:1 to a field in the NLnet propose
form, and budget/rates are left as placeholders to fill after scoping effort.

---

## 1. One-liner (proposal name)

> **Pathland 1.0 — a vetted, implementable open UI-protocol standard.**
> Turn a proof-of-concept 16-byte binary protocol for retained-mode UI into a
> formally specified, fuzzed, benchmarked, and independently implementable open
> standard with a live multi-platform demo.

## 2. Problem

Server-driven UI (SDUI) and cross-platform UI are fragmented: each platform
re-invents retained-mode UI inside a closed framework (Flutter, React Native,
Compose Multiplatform, per-vendor SDUI like Airbnb/Lyft/Spotify). The result:

- **No open, language- and platform-agnostic *protocol* exists** for describing
  declarative, retained-mode UI — only frameworks that couple the UI model to a
  specific runtime.
- **No single wire format** serves the full spectrum from embedded (LVGL on
  microcontrollers) to in-browser (WASM) to server-driven enterprise apps, so
  teams build and maintain N different UI transports.
- **Full-tree serialization is wasteful**: typical SDUI re-sends large JSON
  payloads; large, reactive trees cannot sustain high frame rates on the wire or
  on the main thread.

## 3. Innovation — why this is a standard, not another framework

Pathland describes **WHAT** the UI is — structure + constraint properties
(VStack, HStack, Text, spacing, padding, alignment) — as a stream of **fixed
16-byte opcodes** in a ring buffer, and never **WHERE** (no layout, no rects).
Renderers are **pure functions of the stream**, so the same opcode stream maps
onto native widgets on every platform (GTK4, DOM/HTML, Angular, LVGL-planned).

The engine is **transport- and process-agnostic**: the producer and consumer
only need to exchange bytes, so it runs identically across:

1. **Embedded dual-core** (FreeRTOS): logic on Core 0 → opcodes over an SRAM
   ring → LVGL on Core 1 (ESP32).
2. **Pure in-browser client**: a WASM Web Worker produces into a
   `SharedArrayBuffer` the main-thread DOM renderer consumes — no Virtual DOM
   diffing, no main-thread lock.
3. **Native desktop**: the flat C ABI (`pathland-view-native`) / Java FFM over a
   zero-copy shared ring into GTK4/native widgets.
4. **Distributed / server-driven**: Java (Spring/Quarkus), C# backends emit
   self-contained `PLPL` frames over WebSocket (and, planned, gRPC) to Web,
   mobile, or desktop renderers.

**Emission is diff-based and reactive**: a signal bound to a node re-emits only
that node's deltas; an unchanged tree emits **zero** opcodes. This is what makes
the binary format dramatically smaller than JSON SDUI and fast enough for the
120 FPS interaction target.

The open-standard angle (vs. a framework): anyone can implement a Pathland
renderer or DSL in any language against the spec and the golden conformance
vectors, with no lock-in to a runtime.

## 4. The specification (exists — split, not monolithic)

The normative spec is **already present** in the repository and is treated as
the specification for this proposal:

| File | Content |
|------|---------|
| `spec/OPCODE.md` | 16-byte opcode format, ring buffer, arena, frame lifecycle, value types, design tokens |
| `spec/PRIMITIVES.md` | Primitive views + component IDs (`0x01`–`0x2F`) |
| `spec/MODIFIERS.md` | Core modifiers/properties + value types + enum codes |
| `spec/EVENTS.md` | Core events + listener bits |
| `spec/CONFORMANCE.md` | Golden byte vectors for validating implementations |
| `spec/DSL.md` | The authoring surface (SwiftUI-shaped DSL contract) — authoring, not wire spec |

Gap for the grant: a lightweight **`spec/README.md` index** and a consolidated
**property-key registry** table so the split files read as one implementable
whole (reframed issue #48).

## 5. Work packages

> Budget = cost-recovery. Fill effort (hours) and hourly rate; NLnet pays
> cost-recovery, not commercial rates.

| WP | Deliverable | Maps to | Effort (h) | Rate (€/h) | Cost (€) |
|----|-------------|---------|-----------|-----------|----------|
| **WP1 — Specification** | `spec/README.md` index + consolidated `0x0000`–`0xFFFF` property registry + reconcile conformance vectors | #48 | — | — | — |
| **WP2 — Interop & conformance** | Machine-readable ID schema + cross-language validator CLI (Rust/Java/TS drift guard) + expanded golden vectors | #43 | — | — | — |
| **WP3 — Hardening & safety** | `cargo fuzz` + JS/Java fuzz harnesses; bounds fixes (TS `stringAt`); Miri/sanitizer pass on the C ABI | #37, #38, #39 | — | — | — |
| **WP4 — Evidence** | Benchmark suite vs JSON/Protobuf SDUI + 120 FPS decode harness + CI-generated SVG/MD charts | #40, #41 | — | — | — |
| **WP5 — Packaging, a11y, demo** | CI foundation; `@pathland/web` npm + Swift SPM; WCAG/ARIA on HTML+Angular renderers; hosted multi-platform demo | #44, #45, #47, #49, #50 | — | — | — |
| **PM** | Project management, reporting, communication | — | — | — | — |
| **TOTAL** | | | | | **€** |

### WP notes

- **WP1** is curation/consolidation, not new protocol work — the spec already
  exists (see §4).
- **WP3** is the "trustworthiness" evidence NGI expects (security, testing, CI).
- **WP5** folds in **WCAG/accessibility** from the start — it is an explicit NGI
  deliverable condition, and the >€50k scale-up path requires it anyway.
- The **CI foundation (#50)** is listed in WP5 but is the **first thing to land**:
  it unblocks and evidences WP3–WP5.

## 6. Prior-art comparison

| Existing approach | Why Pathland differs |
|-------------------|----------------------|
| Airbnb/Lyft/Spotify **server-driven UI** | Proprietary, per-app JSON schemas; no open wire format, no native-element mapping, no embedded/browser unification |
| **Flutter / React Native / Compose Multiplatform** | Frameworks that compile/couple UI to one runtime; not a language-agnostic *protocol*; no diff-based binary wire format |
| **Native UI toolkits** (GTK/SwiftUI/WinUI) | Per-platform, closed; no cross-language wire contract |
| **GraphQL / generic serialization** (JSON/Protobuf) | Schema-driven data transport, not a *UI instruction stream*; full-tree, not diff-based |

Differentiation: Pathland is a **16-byte command stream** (tree mutations +
properties), **open-spec**, **process/transport-agnostic**, **native-element**
renderers, **zero-copy** ring, **reactive zero-delta** emission.

## 7. European dimension & ecosystem engagement

- **Digital sovereignty**: an open, Apache-2.0 UI protocol reduces dependence on
  US-owned UI stacks; "made in Europe" alternative for the Open Internet Stack.
- **Open standards / interoperability**: the spec + conformance vectors let any
  EU vendor implement renderers/DSLs; relevant to W3C WebUI-type standardization
  and the Open Internet Stack "independent and cross-platform development
  framework" area.
- **Efficiency/frugality**: 16-byte opcodes + zero-delta emission cut bandwidth
  and device/embedded power vs. JSON SDUI.
- **Engagement plan** (fill in): which projects/standards bodies to reach
  (e.g., LVGL, W3C/WebUI, FOSDEM/IETF/W3C meetings), which EU SDUI/vendor
  ecosystems to pilot with, and how the hosted demo attracts adopters.

## 8. Budget & rates

- Cost-recovery basis; explicit hourly rates and a task/effort breakdown (see
  WP table).
- Indicate past/present funding and other sources (form requirement).
- Add the detailed budget as an attachment to the NLnet form.

## 9. Deliverables & acceptance

All software FOSS (Apache-2.0), all scientific/open outcomes open access.

- [ ] `spec/README.md` index + consolidated property registry (WP1)
- [ ] Schema/validator CLI + expanded golden vectors, CI-gated (WP2)
- [ ] Fuzz harnesses (Rust/TS/Java) + Miri/sanitizer clean C ABI (WP3)
- [ ] Benchmark suite + CI-generated charts (WP4)
- [ ] CI green on all three jobs (WP5)
- [ ] `@pathland/web` npm + Swift SPM scaffold (WP5)
- [ ] WCAG-compliant HTML + Angular renderers (WP5)
- [ ] Hosted multi-platform demo URL (WP5)

## 10. Eligibility

- Applying entity: **company / legal entity** (TBD).
- NLnet's general policy accepts companies of any size and type; **re-verify the
  exact eligibility page of the specific Open Internet Stack fund** when the
  Sept 3 call opens (post-NGI Zero rules may differ).
- EU / Horizon-associated country: eligible (priority for EU inhabitants).

## 11. Timeline

- **Now (Aug 31):** land #50 CI; draft `spec/README.md` + registry; benchmarks.
- **Sept 3:** NLnet calls reopen — submit proposal.
- **Nov 3 (noon CEST):** deadline.
- Budget effort sized against 1–3 month delivery (first-time proposals are
  typically €5k–€50k).

## 12. Open questions / checklist

- [ ] Confirm applying entity (company name, VAT, country).
- [ ] Confirm proposal name + 2-page narrative.
- [ ] Fill WP effort/rates; total budget.
- [ ] Prior-art paragraphs tightened to 3–5 sentences.
- [ ] Pick the NLnet fund/call topic when it opens.
- [ ] GenAI disclosure policy read + completed in the form.