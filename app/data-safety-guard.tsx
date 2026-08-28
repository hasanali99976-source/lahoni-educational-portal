"use client";

import { useEffect } from "react";

const BACKUP_KEY = "lahooni-data-safety-backup-v1";
const PREVIOUS_BACKUP_KEY = "lahooni-data-safety-backup-v1-previous";
const MAX_BACKUP_SIZE = 3_400_000;

const excludedKey = /(?:session|auth|active-subject|last-path|install-dismissed|data-safety-backup)/i;
const protectedKey = /(?:lahooni|attendance|roster|grade|diagnostic|exam|test|portfolio|timetable|lesson|plan|preparation|tahdir|teacher|student)/i;

type DataSnapshot = {
  version: 1;
  savedAt: string;
  entries: Record<string, string>;
};

function readSnapshot(key: string): DataSnapshot | null {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value) as DataSnapshot;
    if (parsed?.version !== 1 || !parsed.entries || typeof parsed.entries !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function restoreMissingProtectedData() {
  const snapshots = [readSnapshot(BACKUP_KEY), readSnapshot(PREVIOUS_BACKUP_KEY)].filter(Boolean) as DataSnapshot[];
  for (const snapshot of snapshots) {
    for (const [key, value] of Object.entries(snapshot.entries)) {
      if (!protectedKey.test(key) || excludedKey.test(key)) continue;
      try {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
      } catch {
        return;
      }
    }
  }
}

function createSnapshot() {
  try {
    const entries: Record<string, string> = {};
    let size = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || excludedKey.test(key) || !protectedKey.test(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value === null) continue;
      const nextSize = size + key.length + value.length;
      if (nextSize > MAX_BACKUP_SIZE) break;
      entries[key] = value;
      size = nextSize;
    }

    const next: DataSnapshot = { version: 1, savedAt: new Date().toISOString(), entries };
    const serialized = JSON.stringify(next);
    const current = window.localStorage.getItem(BACKUP_KEY);
    if (current && current !== serialized) {
      try { window.localStorage.setItem(PREVIOUS_BACKUP_KEY, current); } catch {}
    }
    window.localStorage.setItem(BACKUP_KEY, serialized);
  } catch {
    // لا تتعطل البوابة إذا كان تخزين المتصفح ممتلئًا أو محجوبًا.
  }
}

export default function DataSafetyGuard() {
  useEffect(() => {
    restoreMissingProtectedData();
    createSnapshot();

    const interval = window.setInterval(createSnapshot, 30_000);
    const onPageHide = () => createSnapshot();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") createSnapshot();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      createSnapshot();
    };
  }, []);

  return null;
}
