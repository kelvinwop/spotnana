import { afterEach as afterEachBun, beforeEach as beforeEachBun } from "bun:test";
import { JSDOM } from "jsdom";
import { afterEach as afterEachNode, beforeEach as beforeEachNode } from "node:test";
import { resetTestBrowserState } from "./browserStorageIsolation";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

const { window } = dom;

const requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return window.setTimeout(() => callback(Date.now()), 0);
};

const cancelAnimationFrame = (handle: number): void => {
  window.clearTimeout(handle);
};

window.requestAnimationFrame = requestAnimationFrame;
window.cancelAnimationFrame = cancelAnimationFrame;

Object.defineProperties(globalThis, {
  window: { configurable: true, value: window },
  document: { configurable: true, value: window.document },
  navigator: { configurable: true, value: window.navigator },
  HTMLElement: { configurable: true, value: window.HTMLElement },
  HTMLButtonElement: { configurable: true, value: window.HTMLButtonElement },
  HTMLDivElement: { configurable: true, value: window.HTMLDivElement },
  HTMLTextAreaElement: { configurable: true, value: window.HTMLTextAreaElement },
  Element: { configurable: true, value: window.Element },
  Node: { configurable: true, value: window.Node },
  Event: { configurable: true, value: window.Event },
  CustomEvent: { configurable: true, value: window.CustomEvent },
  KeyboardEvent: { configurable: true, value: window.KeyboardEvent },
  MouseEvent: { configurable: true, value: window.MouseEvent },
  DOMException: { configurable: true, value: window.DOMException },
  MutationObserver: { configurable: true, value: window.MutationObserver },
  getComputedStyle: { configurable: true, value: window.getComputedStyle.bind(window) },
  localStorage: { configurable: true, value: dom.window.localStorage },
  sessionStorage: { configurable: true, value: dom.window.sessionStorage },
  crypto: { configurable: true, value: window.crypto },
  requestAnimationFrame: { configurable: true, value: requestAnimationFrame },
  cancelAnimationFrame: { configurable: true, value: cancelAnimationFrame },
});

function installPerTestBrowserReset(registerBeforeEach: (run: () => void) => void): void {
  registerBeforeEach(() => {
    resetTestBrowserState();
  });
}

function installPerTestBrowserCleanup(registerAfterEach: (run: () => void) => void): void {
  registerAfterEach(() => {
    resetTestBrowserState();
  });
}

resetTestBrowserState();
installPerTestBrowserReset(beforeEachBun);
installPerTestBrowserCleanup(afterEachBun);
installPerTestBrowserReset(beforeEachNode);
installPerTestBrowserCleanup(afterEachNode);

if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

if (typeof window.toast !== "function") {
  window.toast = function toast() {};
}

export {};
