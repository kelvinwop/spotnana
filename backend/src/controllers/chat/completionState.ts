const DEDUP_WINDOW_MS = 2000;

interface ActiveCompletionRecord {
  readonly requestId: string;
  readonly startedAt: number;
}

const activeAccountRequests = new Map<string, Map<string, ActiveCompletionRecord>>();
const activeGuestRequests = new Map<string, Map<string, ActiveCompletionRecord>>();

function normalizeFingerprint(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ").toLowerCase();
}

function getRequestBucket(mode: "guest" | "account") {
  return mode === "guest" ? activeGuestRequests : activeAccountRequests;
}

function getOrCreateSubjectRequests(
  bucket: Map<string, Map<string, ActiveCompletionRecord>>,
  subjectId: string
): Map<string, ActiveCompletionRecord> {
  const existing = bucket.get(subjectId);
  if (existing) {
    return existing;
  }

  const subjectRequests = new Map<string, ActiveCompletionRecord>();
  bucket.set(subjectId, subjectRequests);
  return subjectRequests;
}

export function registerCompletionRequest(input: {
  mode: "guest" | "account";
  subjectId: string;
  prompt: string;
}): { accepted: true; requestId: string } | { accepted: false; retryAfterMs: number } {
  const bucket = getRequestBucket(input.mode);
  const now = Date.now();
  const fingerprint = normalizeFingerprint(input.prompt);
  const subjectRequests = getOrCreateSubjectRequests(bucket, input.subjectId);
  const existing = subjectRequests.get(fingerprint);

  if (existing && now - existing.startedAt < DEDUP_WINDOW_MS) {
    return {
      accepted: false,
      retryAfterMs: DEDUP_WINDOW_MS - (now - existing.startedAt),
    };
  }

  const requestId = crypto.randomUUID();
  subjectRequests.set(fingerprint, {
    requestId,
    startedAt: now,
  });

  return { accepted: true, requestId };
}

export function releaseCompletionRequest(input: {
  mode: "guest" | "account";
  subjectId: string;
  prompt: string;
  requestId: string;
}): void {
  const bucket = getRequestBucket(input.mode);
  const subjectRequests = bucket.get(input.subjectId);
  if (!subjectRequests) {
    return;
  }

  const fingerprint = normalizeFingerprint(input.prompt);
  const activeRequest = subjectRequests.get(fingerprint);
  if (!activeRequest || activeRequest.requestId !== input.requestId) {
    return;
  }

  subjectRequests.delete(fingerprint);
  if (subjectRequests.size === 0) {
    bucket.delete(input.subjectId);
  }
}

export function resetCompletionStateForTests(): void {
  activeAccountRequests.clear();
  activeGuestRequests.clear();
}
