/**
 * Persistence Adapter — single boundary for all versioned localStorage access.
 *
 * This module is the ONLY place that directly writes to/reads from localStorage.
 * All persisted Jotai atoms MUST use `createVersionedStorage` from here.
 *
 * Stored format: { v: T, data: T, writtenAt: number }
 */

export const STORAGE_VERSION = 1;

interface VersionedEnvelope<T> {
  readonly v: number;
  readonly data: T;
  readonly writtenAt: number;
}

/** Structured error payload emitted via console.warn on persistence failures. */
interface PersistenceError {
  readonly key: string;
  readonly kind: "ParseError" | "SchemaError" | "UnsupportedVersion";
  readonly currentVersion: number;
  readonly storedVersion?: number;
  readonly actionTaken: "resetToDefault";
}

export interface StorageValidator<T> {
  readonly isValid: (value: unknown) => value is T;
}

/**
 * Jotai-compatible synchronous storage adapter interface.
 * Matches the SyncStorage<T> shape expected by `atomWithStorage`.
 */
export interface StorageAdapter<T> {
  getItem: (key: string, initialValue: T) => T;
  setItem: (key: string, value: T) => void;
  removeItem: (key: string) => void;
}

export interface BrowserStorageState {
  readonly localStorageItemCount: number;
  readonly sessionStorageItemCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVersionedEnvelope(value: unknown): value is VersionedEnvelope<unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value["v"] === "number" && "data" in value && typeof value["writtenAt"] === "number";
}

function emitPersistenceError(persistenceError: PersistenceError, error?: unknown): void {
  const details = typeof error === "undefined" ? persistenceError : { ...persistenceError, error };
  console.warn("[PersistenceAdapter] Persistence reset to default.", details);
}

export function readBrowserStorageState(): BrowserStorageState {
  if (typeof window === "undefined") {
    return {
      localStorageItemCount: 0,
      sessionStorageItemCount: 0,
    };
  }

  return {
    localStorageItemCount: window["localStorage"].length,
    sessionStorageItemCount: window["sessionStorage"].length,
  };
}

export function clearBrowserStorageBoundary(): void {
  if (typeof window === "undefined") {
    return;
  }

  window["localStorage"].clear();
  window["sessionStorage"].clear();
}

/**
 * Creates a versioned Jotai storage adapter for the given localStorage key.
 *
 * The `storageKey` parameter is the actual localStorage key used for storage.
 * The first argument Jotai passes to getItem/setItem/removeItem (the atom key)
 * is intentionally ignored — the `storageKey` closure value is authoritative.
 *
 * On version mismatch or parse/schema error: resets to `initialValue` and emits a
 * structured warning via `console.warn` with a `[PersistenceAdapter]` prefix.
 */
export function createVersionedStorage<T>(
  storageKey: string,
  version: number,
  validator: StorageValidator<T>
): StorageAdapter<T> {
  return {
    getItem(_atomKey: string, initialValue: T): T {
      if (typeof window === "undefined") {
        return initialValue;
      }

      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) {
        return initialValue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch (error: unknown) {
        emitPersistenceError(
          {
            key: storageKey,
            kind: "ParseError",
            currentVersion: version,
            actionTaken: "resetToDefault",
          },
          error
        );
        return initialValue;
      }

      if (!isVersionedEnvelope(parsed)) {
        emitPersistenceError({
          key: storageKey,
          kind: "SchemaError",
          currentVersion: version,
          actionTaken: "resetToDefault",
        });
        return initialValue;
      }

      if (parsed.v !== version) {
        emitPersistenceError({
          key: storageKey,
          kind: "UnsupportedVersion",
          storedVersion: parsed.v,
          currentVersion: version,
          actionTaken: "resetToDefault",
        });
        return initialValue;
      }

      if (!validator.isValid(parsed.data)) {
        emitPersistenceError({
          key: storageKey,
          kind: "SchemaError",
          storedVersion: parsed.v,
          currentVersion: version,
          actionTaken: "resetToDefault",
        });
        return initialValue;
      }

      return parsed.data;
    },

    setItem(_atomKey: string, value: T): void {
      if (typeof window === "undefined") {
        return;
      }
      const envelope: VersionedEnvelope<T> = {
        v: version,
        data: value,
        writtenAt: Date.now(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(envelope));
    },

    removeItem(_atomKey: string): void {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.removeItem(storageKey);
    },
  };
}
