"use client";

import { useEffect } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

const VOICE_KEY = "lahooni.teacher.welcome.v2";

export default function TeacherWelcomeVoice() {
  const session = useTeacherClient();

  useEffect(() => {
    const name = String(session.teacherName || "").trim();
    if (!name || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const identity = `${session.teacherId || name}:${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(VOICE_KEY) === identity) return;

    const speak = () => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`مرحباً أستاذ ${name}. أهلاً بك في بوابة أستاذ لحوني التعليمية. أتمنى لك يوماً تعليمياً موفقاً ومؤثراً.`);
        utterance.lang = "ar-SA";
        utterance.rate = 0.92;
        utterance.pitch = 1;
        const voices = window.speechSynthesis.getVoices();
        const arabic = voices.find(voice => /^ar-SA/i.test(voice.lang)) || voices.find(voice => /^ar/i.test(voice.lang));
        if (arabic) utterance.voice = arabic;
        window.speechSynthesis.speak(utterance);
        sessionStorage.setItem(VOICE_KEY, identity);
      } catch {
        // The visual portal must never fail if the browser blocks speech.
      }
    };

    const timer = window.setTimeout(speak, 700);
    window.speechSynthesis.addEventListener?.("voiceschanged", speak, { once: true });
    return () => window.clearTimeout(timer);
  }, [session.teacherId, session.teacherName]);

  return null;
}
