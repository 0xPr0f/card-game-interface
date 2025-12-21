// This must be a .js file (not .ts) to ensure it runs before any TypeScript compilation
// Polyfill for packages that expect Node.js global object
if (typeof window !== 'undefined') {
  window.global = window.global || window;
}
