# Pathland — Grant Proposal (Submittable Draft)

**Fund:** NLnet / NGI "Open Internet Stack" — new fund calls reopen **Sept 3, 2026**; deadline **Nov 3, 2026, 12:00 CET**
**Status:** Ready to adapt into the NLnet propose form
**Prepared:** 2026-08-31

> **Proposal name:**
> **Pathland — an implementable open UI-protocol standard: specification, conformance, validation, hardening, evidence.**

---

## 1. Applicant

| Field | Value |
|-------|-------|
| Legal entity | Apaq ApS |
| Country | Denmark (EU) |
| VAT / CVR | DK41717955 |
| Website | https://apaq.dk |
| Contact | Michael Krog · mic@apaq.dk |
| Role | Founder / lead developer (solo) |
| Capacity | Part-time R&D, 10 h/week during the project |

---

## 2. Problem

Server-driven UI (SDUI) and cross-platform UI are fragmented: each platform
re-invents retained-mode UI inside a closed framework (Flutter, React Native,
Compose Multiplatform, per-vendor SDUI like Airbnb/Lyft/Spotify). The result:

- **No open, language- and platform-agnostic *protocol*** exists for describing
  declarative, retained-mode UI — only frameworks that couple the UI model to a
  specific runtime.
- **No single wire format** serves the full spectrum from embedded (LVGL on
  microcontrollers) to in-browser to server-driven enterprise apps, so teams
  build and maintain N different UI transports.
- **Full-tree serialization is wasteful**: typical SDUI re-sends large JSON
  payloads; large, reactive trees cannot sustain high frame rates on the wire or
  on the main thread.

## 3. Innovation — a standard, not another framework

Pathland describes **WHAT** the UI is — structure + constraint properties
(VStack, HStack, Text, spacing, padding, alignment) — as a stream of **fixed
16-byte opcodes** in a ring buffer, and never **WHERE** (no layout, no rects).
Renderers are **pure functions of the stream**, so the same opcode stream maps
onto native widgets on every platform (GTK4, DOM/HTML, LVGL-planned).

The engine is **transport- and process-agnostic**: the producer and consumer
only need to exchange bytes, so it runs identically across embedded dual-core,
pure in-browser (WASM worker → `SharedArrayBuffer`), native desktop (C ABI /
Java FFM over a zero-copy shared ring), and distributed server-driven modes.

**Emission is diff-based and reactive**: a signal bound to a node re-emits only
that node's deltas; an unchanged tree emits **zero** opcodes. That is what makes
the binary format dramatically smaller than JSON SDUI and fast enough for a
120 FPS interaction target.

The open-standard angle: anyone can implement a Pathland renderer or DSL in any
language against the spec and the golden conformance vectors, with no lock-in to
a runtime.

## 4. The specification (exists — split, not monolithic)

The normative spec is **already present** and is the contract this proposal
matures:

| File | Content |
|------|---------|
| `spec/OPCODE.md` | 16-byte opcode format, ring buffer, arena, frame lifecycle, value types, design tokens |
| `spec/PRIMITIVES.md` | Primitive views + component IDs |
| `spec/MODIFIERS.md` | Core modifiers/properties + value types + enum codes |
| `spec/EVENTS.md` | Core events + listener bits |
| `spec/CONFORMANCE.md` | Golden byte vectors |
| `spec/DSL.md` | Authoring surface (SwiftUI-shaped DSL contract) — informative |

Gap this proposal fills: a **spec index + consolidated property-key registry**
and a **cross-language validator** so the split files read as one implementable
whole and cannot drift.

## 5. Scope & work packages (core-first)

The **core is the deliverable** (an implementable open standard); the visual
layer is cheap proof, not the product.

| WP | Deliverable | Issue | Effort (h) | Cost @€45/h |
|----|-------------|-------|-----------|-------------|
| WP1 | `spec/README.md` index + consolidated `0x0000–0xFFFF` property-key registry (derived, cross-checked against all four language surfaces) | #48 | 30 | €1,350 |
| WP2 | Machine-readable ID schema + cross-language validator CLI (Rust/Java drift guard) + expanded golden conformance vectors (validation only — codegen deferred) | #43 | 80 | €3,600 |
| WP3 | Coverage-guided fuzz harnesses (Rust/JS/Java), TS `stringAt` bounds fix, one Miri pass on the C ABI | #37, #38 | 70 | €3,150 |
| WP4 | Benchmark suite: 16-byte vs JSON/Protobuf SDUI (payload size, decode latency, memory) + one CI chart | #40 | 30 | €1,350 |
| WP5 | CI completion (rust + java jobs), hosted SSR HTML demo (URL + screenshots), evidence pack | #49, #50 | 35 | €1,575 |
| PM / reporting (10%) | NLnet reporting, MoU tracking | — | 15 | €675 |
| **Total** | | | **260 h** | **€11,700** |

## 6. Budget & rates

- **Cost-recovery**, rate **€45/h**, **260 h**, total ask **€11,700**.
- NLnet may adjust ineligible costs; the final amount is settled in the MoU.
- No other funding sources at present.

## 7. Evidence layer (the demo is proof, not the product)

The web path already exists (SSR HTML renderer + the demos' vanilla-JS `app.js`
client). WP5 makes it visible cheaply: host the existing Quarkus SSR demo at a
public URL, include 2 screenshots and the WP4 comparison chart. Reviewers can
click a working multi-renderer demo without the core work being a "black box".

## 8. Prior-art comparison

Airbnb, Lyft and Spotify ship proprietary, per-app SDUI JSON schemas — closed,
not an open standard. Flutter, React Native and Compose Multiplatform are
frameworks that couple the UI model to one runtime. Native toolkits (GTK,
SwiftUI, WinUI) are per-platform and closed. Generic serialization (JSON,
Protobuf) is schema-driven data transport, not a UI instruction stream, and
re-sends full trees. Pathland is a **16-byte command stream** (tree mutations +
properties), open-spec, process/transport-agnostic, with native-element renderers
and zero-copy, diff-based emission — an open standard, not another framework.

## 9. European dimension & ecosystem

- **Digital sovereignty**: an open, Apache-2.0 UI protocol reduces dependence on
  US-owned UI stacks — a "made in Europe" alternative for the Open Internet
  Stack's *independent and cross-platform development framework* area.
- **Open standards / interoperability**: spec + conformance vectors let any EU
  vendor implement renderers/DSLs; relevant to W3C/WebUI-type standardization.
- **Efficiency/frugality**: 16-byte opcodes + zero-delta emission cut bandwidth
  and embedded power vs JSON SDUI.
- **Engagement**: reach out to adjacent open projects (LVGL for the embedded
  renderer, W3C WebUI) and present at FOSDEM/IETF/W3C-style venues; publish the
  validator as a reusable tool for any SDUI adopter.

## 10. Timeline

| Milestone | Date |
|-----------|------|
| Submit proposal | Sept 3, 2026 (calls open) |
| Deadline | Nov 3, 2026, 12:00 CET |
| Decision / MoU | ~Dec 2026 |
| Project | Jan–Jun 2027 (6 months, 10 h/week) |
| Deliverables + final report | Jun 2027 |

## 11. Deliverables & acceptance

All software FOSS (Apache-2.0); all open outcomes open access. Deliverables are
WCAG-compliant where they include web surfaces.

- [ ] `spec/README.md` + consolidated property registry (WP1)
- [ ] Schema + validator CLI + expanded conformance vectors, CI-gated (WP2)
- [ ] Fuzz harnesses (Rust/JS/Java) + C ABI Miri pass (WP3)
- [ ] Benchmark suite + comparison chart (WP4)
- [ ] CI green (rust + java), hosted demo URL, screenshots (WP5)
- [ ] NLnet final report + MoU deliverables (PM)

## 12. Two-page narrative (copy-ready for the NLnet form)

**Proposal name:** Pathland — an implementable open UI-protocol standard.

**What it is.** Pathland is an open, Apache-2.0 protocol for declarative,
retained-mode UI that is language- and platform-agnostic. It describes *what* a
UI is — VStack, HStack, Text, spacing, padding, alignment — as a stream of fixed
**16-byte opcodes**, never *where*. Emission is diff-based and reactive: only the
nodes that changed emit, an unchanged tree emits zero opcodes, and renderers are
pure functions of the stream that map onto native elements (GTK4, DOM/HTML,
LVGL-planned). The engine is transport- and process-agnostic, running from
embedded dual-core to in-browser WASM to distributed server-driven backends.
The spec already exists (split across `spec/OPCODE`, `PRIMITIVES`, `MODIFIERS`,
`EVENTS`, `CONFORMANCE`, plus the `DSL` authoring surface) and is enforced by
golden byte vectors.

**What we will build.** This project turns the working proof-of-concept into an
**implementable open standard**: (1) a spec index and consolidated
property-key registry; (2) a machine-readable ID schema and cross-language
validator so the four language surfaces cannot drift; (3) coverage-guided fuzzing
and a Miri pass proving the decoders and the C ABI are robust against malformed
input; (4) a benchmark suite quantifying the 16-byte-vs-JSON/Protobuf claim; and
(5) CI plus a hosted SSR HTML demo as live evidence. A solo maintainer delivers
this in six months at 260 hours (cost-recovery, €11,700).

**Why it matters.** An open UI *protocol* — rather than another UI *framework* —
lets any EU vendor build renderers and DSLs against one spec, reducing lock-in to
US-owned stacks and supporting the Open Internet Stack's cross-platform
development goal. The 16-byte, zero-delta wire format is an efficiency answer to
bloated JSON SDUI. Prior art (Airbnb/Lyft/Spotify SDUI, Flutter, React Native)
is closed or runtime-coupled; nothing provides an open, diff-based binary
instruction stream across embedded, browser, desktop, and server.

**European dimension.** Made in Denmark; Apache-2.0; engagement with LVGL, W3C
WebUI, and EU open-source venues; the validator and conformance suite become a
reusable tool for any SDUI adopter.

## 13. Open items (to confirm before submission)

- [ ] Re-verify the specific fund's eligibility page when the Sept 3 call opens
  (post-NGI rules may differ; NLnet's general policy accepts companies of any
  size).
- [ ] Confirm GenAI-disclosure preference (none used in this document's drafting
  beyond tool-assisted editing).
- [ ] Finalize the NLnet form fields: call topic, exact wording, attachments
  (budget table, screenshots, repo link).