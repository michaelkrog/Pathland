import { defineConfig } from 'vitest/config';

/**
 * Standalone vitest config for the pure protocol/renderer unit specs
 * (`core.spec.ts`, `mapping.spec.ts`).
 *
 * `app.spec.ts` exercises the Angular component via TestBed and runs under the
 * Angular unit-test builder instead: `ng test` (the package's `test` script)
 * drives all specs with the builder-injected TestBed environment.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    exclude: ['src/app/app.spec.ts'],
  },
});