/**
 * Ambient type declarations for Vite-specific module conventions used by the POC.
 */

// Vite: `import url from './worker?worker&url'` yields the worker URL string.
declare module '*?worker&url' {
  const workerUrl: string;
  export default workerUrl;
}

// Vite: `import Worker from './worker?worker'` yields a Worker constructor.
declare module '*?worker' {
  const workerConstructor: new (options?: { name?: string }) => Worker;
  export default workerConstructor;
}
