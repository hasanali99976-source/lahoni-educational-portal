"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type PortalVoiceGreetingProps = {
  role: "teacher" | "student";
  name?: string;
  identityKey?: string;
  compact?: boolean;
};

declare global {
  interface Window {
    OstadhApp?: {
      speakArabic?: (text: string) => void;
      stopSpeech?: () => void;
    };
    __OSTADH_ANDROID__?: boolean;
  }
}

function cleanName(value?: string) {
  const name = String(value || "").trim().replace(/^(الأستاذ|استاذ|أستاذ|المعلم|الطالب|أ\.)\s*/u, "").trim();
  if (!name || ["المعلم", "الطالب", "مستخدم"].includes(name)) return "";
  return name.slice(0, 80);
}

function riyadhHour() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Number(parts.find(part => part.type === "hour")?.value || 12);
}

function greetingText(role: "teacher" | "student", name?: string) {
  const person = cleanName(name);
  const hour = riyadhHour();
  const daypart = hour >= 5 && hour < 12 ? "صباح الخير" : hour >= 12 && hour < 18 ? "مساء الخير" : "أهلًا وسهلًا";
  if (role === "teacher") {
    return person
      ? `مرحبًا أستاذ ${person}. ${daypart}. أهلًا بك في بوابة أستاذ لحوني التعليمية، ونتمنى لك وقتًا موفقًا.`
      : `مرحبًا أستاذ. ${daypart}. أهلًا بك في بوابة أستاذ لحوني التعليمية، ونتمنى لك وقتًا موفقًا.`;
  }
  return person
    ? `مرحبًا ${person}. ${daypart}. كيف حالك اليوم؟ نتمنى لك يومًا دراسيًا موفقًا ومميزًا.`
    : `مرحبًا بك. ${daypart}. نتمنى لك يومًا دراسيًا موفقًا ومميزًا.`;
}

function chooseArabicVoice(voices: SpeechSynthesisVoice[]) {
  const arabic = voices.filter(voice => /^ar(?:-|$)/i.test(voice.lang));
  return arabic.find(voice => /sa/i.test(voice.lang)) || arabic.find(voice => /female|natural|microsoft|google/i.test(voice.name)) || arabic[0] || null;
}

export default function PortalVoiceGreeting({ role, name, identityKey }: PortalVoiceGreetingProps) {
  const attemptedRef = useRef(false);
  const startedRef = useRef(false);
  const text = useMemo(() => greetingText(role, name), [role, name]);

  const speak = useCallback(() => {
    if (typeof window === "undefined") return false;

    const isNativeAndroid = Boolean(window.__OSTADH_ANDROID__) || /OstadhLahooniAndroid/i.test(navigator.userAgent);
    if (isNativeAndroid && window.OstadhApp?.speakArabic) {
      try {
        window.OstadhApp.speakArabic(text);
        startedRef.current = true;
        return true;
      } catch {
        startedRef.current = false;
      }
    }

    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ar-SA";
      utterance.rate = 0.94;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voice = chooseArabicVoice(window.speechSynthesis.getVoices());
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { startedRef.current = true; };
      utterance.onerror = () => { startedRef.current = false; };
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      startedRef.current = false;
      return false;
    }
  }, [text]);

  useEffect(() => {
    if (typeof window === "undefined" || !identityKey || attemptedRef.current) return;
    attemptedRef.current = true;
    startedRef.current = false;
    let cancelled = false;

    const trySpeak = () => {
      if (!cancelled && !startedRef.current) speak();
    };

    const timer = window.setTimeout(trySpeak, 180);
    const retryTimer = window.setTimeout(trySpeak, 900);
    const voicesChanged = () => trySpeak();
    const interactionFallback = () => {
      if (!startedRef.current) trySpeak();
      if (startedRef.current) {
        window.removeEventListener("pointerdown", interactionFallback, true);
        window.removeEventListener("keydown", interactionFallback, true);
        window.removeEventListener("touchstart", interactionFallback, true);
      }
    };

    window.speechSynthesis?.addEventListener?.("voiceschanged", voicesChanged);
    window.addEventListener("pointerdown", interactionFallback, true);
    window.addEventListener("keydown", interactionFallback, true);
    window.addEventListener("touchstart", interactionFallback, true);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(retryTimer);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", voicesChanged);
      window.removeEventListener("pointerdown", interactionFallback, true);
      window.removeEventListener("keydown", interactionFallback, true);
      window.removeEventListener("touchstart", interactionFallback, true);
      try { window.OstadhApp?.stopSpeech?.(); } catch {}
      window.speechSynthesis?.cancel();
    };
  }, [identityKey, speak]);

  return null;
}
