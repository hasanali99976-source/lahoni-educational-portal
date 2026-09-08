"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type PortalVoiceGreetingProps = {
  role: "teacher" | "student";
  name?: string;
  identityKey?: string;
  compact?: boolean;
};

type NativeSpeechBridge = {
  speakArabic?: (text: string) => void;
  stopSpeech?: () => void;
  isSpeechReady?: () => boolean;
};

declare global {
  interface Window {
    OstadhTts?: {
      speakArabic?: (text: string) => void;
      stopSpeech?: () => void;
      isReady?: () => boolean;
    };
    __OSTADH_ANDROID__?: boolean;
  }
}

function cleanName(value?: string) {
  const name = String(value || "")
    .trim()
    .replace(/^(الأستاذ|استاذ|أستاذ|المعلم|الطالب|أ\.)\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || ["المعلم", "الطالب", "مستخدم"].includes(name)) return "";
  const parts = name.split(" ");
  const deduped = parts.filter((part, index) => index === 0 || part !== parts[index - 1]);
  return deduped.join(" ").slice(0, 60);
}

function greetingText(role: "teacher" | "student", name?: string) {
  const person = cleanName(name);
  if (role === "teacher") {
    return person
      ? `هلا أستاذ ${person}، حياك الله في بوابة أستاذ لحوني التعليمية.`
      : "هلا أستاذ، حياك الله في بوابة أستاذ لحوني التعليمية.";
  }
  return person
    ? `هلا ${person}، حياك الله. الله يوفقك اليوم.`
    : "هلا بك، حياك الله. الله يوفقك اليوم.";
}

function chooseArabicVoice(voices: SpeechSynthesisVoice[]) {
  const arabic = voices.filter(voice => /^ar(?:-|$)/i.test(voice.lang));
  return arabic.find(voice => /^ar-SA$/i.test(voice.lang))
    || arabic.find(voice => /saudi|saudi arabia|ar-sa/i.test(`${voice.name} ${voice.lang}`))
    || arabic.find(voice => /natural|microsoft|google/i.test(voice.name))
    || arabic[0]
    || null;
}

export default function PortalVoiceGreeting({ role, name, identityKey }: PortalVoiceGreetingProps) {
  const attemptedRef = useRef("");
  const startedRef = useRef(false);
  const text = useMemo(() => greetingText(role, name), [role, name]);

  const speak = useCallback(() => {
    if (typeof window === "undefined") return false;

    const nativeApp = (window as unknown as { OstadhApp?: NativeSpeechBridge }).OstadhApp;
    try {
      if (nativeApp?.speakArabic) {
        nativeApp.speakArabic(text);
        startedRef.current = true;
        return true;
      }
      if (window.OstadhTts?.speakArabic) {
        window.OstadhTts.speakArabic(text);
        startedRef.current = true;
        return true;
      }
    } catch {
      startedRef.current = false;
    }

    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ar-SA";
      utterance.rate = 0.9;
      utterance.pitch = 0.98;
      utterance.volume = 0.9;
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
    if (typeof window === "undefined" || !identityKey || attemptedRef.current === identityKey) return;
    attemptedRef.current = identityKey;
    startedRef.current = false;
    let cancelled = false;

    const trySpeak = () => {
      if (!cancelled && !startedRef.current) speak();
    };

    const timer = window.setTimeout(trySpeak, 350);
    const retryTimer = window.setTimeout(trySpeak, 1100);
    const voicesChanged = () => trySpeak();

    window.speechSynthesis?.addEventListener?.("voiceschanged", voicesChanged);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(retryTimer);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", voicesChanged);
    };
  }, [identityKey, speak]);

  return null;
}
