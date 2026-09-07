"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type PortalVoiceGreetingProps = {
  role: "teacher" | "student";
  name?: string;
  identityKey?: string;
  compact?: boolean;
};

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

export default function PortalVoiceGreeting({ role, name, identityKey, compact = false }: PortalVoiceGreetingProps) {
  const [speaking, setSpeaking] = useState(false);
  const attemptedRef = useRef(false);
  const text = useMemo(() => greetingText(role, name), [role, name]);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ar-SA";
      utterance.rate = 0.94;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voice = chooseArabicVoice(window.speechSynthesis.getVoices());
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      setSpeaking(false);
      return false;
    }
  }, [text]);

  useEffect(() => {
    if (typeof window === "undefined" || !identityKey || attemptedRef.current) return;
    attemptedRef.current = true;

    let cancelled = false;
    const trySpeak = () => {
      if (!cancelled) speak();
    };

    const timer = window.setTimeout(trySpeak, 350);
    const voicesChanged = () => {
      if (!cancelled && !speaking) trySpeak();
    };
    window.speechSynthesis?.addEventListener?.("voiceschanged", voicesChanged);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", voicesChanged);
      window.speechSynthesis?.cancel();
    };
  }, [identityKey, speak, speaking]);

  const style: CSSProperties = compact ? {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38,
    borderRadius: 12, border: "1px solid rgba(15,23,42,.12)", background: "rgba(255,255,255,.92)",
    cursor: "pointer", fontSize: 18, boxShadow: "0 4px 16px rgba(15,23,42,.06)", flex: "0 0 auto",
  } : {
    display: "inline-flex", alignItems: "center", gap: 7, minHeight: 38, padding: "0 12px",
    borderRadius: 12, border: "1px solid rgba(15,23,42,.12)", background: "rgba(255,255,255,.92)",
    cursor: "pointer", fontWeight: 800, color: "#18324a", boxShadow: "0 4px 16px rgba(15,23,42,.06)",
  };

  return <button
    type="button"
    style={style}
    onClick={() => speak()}
    aria-label="إعادة تشغيل الترحيب الصوتي"
    title="تشغيل الترحيب الصوتي"
  >
    <span aria-hidden="true">{speaking ? "🔊" : "🔉"}</span>
    {!compact ? <span>{speaking ? "الترحيب يعمل" : "الترحيب الصوتي"}</span> : null}
  </button>;
}
