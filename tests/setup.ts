import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { db } from "../db";

// React act() environment for useSyncExternalStore (dexie-react-hooks live queries).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ------------------------------------------------------------------ */
/* jsdom stubs — browser APIs the app touches but jsdom lacks.         */
/* ------------------------------------------------------------------ */

if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

window.HTMLElement.prototype.scrollIntoView ??= () => {};

URL.createObjectURL ??= () => "blob:mock";
URL.revokeObjectURL ??= () => {};

window.confirm ??= () => true;

if (typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0)) as unknown as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as unknown as typeof window.cancelAnimationFrame;
}

/* ------------------------------------------------------------------ */
/* Fresh database per test. fake-indexeddb/auto provides the global;   */
/* clearing the tables keeps suites order-independent.                 */
/* ------------------------------------------------------------------ */

beforeEach(async () => {
  await db.notes.clear();
  await db.settings.clear();
});
