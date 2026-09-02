# Third-party notices

## Tailwind CSS preflight reset

The renderer's built-in `<style>` block includes a **preflight reset** vendored
from Tailwind CSS. Tailwind CSS is distributed under the MIT license:

```
MIT License

Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Inter (default font)

The default `--pl-font-sans` uses the **Inter** typeface, loaded at runtime from
the **rsms.me CDN** (served by Cloudflare) via
`https://rsms.me/inter/inter.css` — the renderer does **not** bundle the font
binary. Inter is distributed under the SIL Open Font License 1.1; Rasmus
Andersson's copyright notice and the OFL 1.1 license text apply. See
https://github.com/rsms/inter/blob/master/LICENSE.txt for the canonical license
text.

**Follow-up:** self-hosting the Inter webfont (subsetted woff2, bundled with the
renderer / embedded in the renderer jar) is planned for offline and
enterprise/air-gapped deployments. When a self-hosted Inter webfont is bundled,
the OFL 1.1 license text and the Inter copyright notice must be included
alongside it.
