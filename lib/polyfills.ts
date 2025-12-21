// Polyfill for packages that expect Node.js global object
if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
  (window as any).global = globalThis;
}
