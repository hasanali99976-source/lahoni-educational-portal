"use client";

import { useEffect, useRef } from "react";

export default function StudentWelcomeVoice() {
  const lastSpoken = useRef("");

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const speak = () => {
      const heading = document.querySelector(".sv10-chooser-head h1");
      const text = String(heading?.textContent || "").trim();
      const name = text.replace(/^مرحبًا\s*/, "").trim();
      if (!name || name === "الطالب" || lastSpoken.current === name) return;
      lastSpoken.current = name;
      const utterance = new SpeechSynthesisUtterance(`مرحبًا ${name}، أهلاً بك في بوابة أستاذ لحوني التعليمية`);
      utterance.lang = "ar-SA";
      utterance.rate = 0.92;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    speak();
    const observer = new MutationObserver(() => speak());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
