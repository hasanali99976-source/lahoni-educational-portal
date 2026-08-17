"use client";

import { useEffect } from "react";

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext; __ostadhIntroPlayed?: boolean };

function playIntro() {
  const w = window as AudioWindow;
  if (w.__ostadhIntroPlayed) return;
  const AudioCtor = window.AudioContext || w.webkitAudioContext;
  if (!AudioCtor) return;
  try {
    const ctx = new AudioCtor();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.04);
    const notes = [523.25, 659.25, 783.99, 659.25];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      const start = ctx.currentTime + index * 0.13;
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);
    w.__ostadhIntroPlayed = true;
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    // بعض المتصفحات تمنع الصوت حتى أول تفاعل؛ المستمعات أدناه تعيد المحاولة.
  }
}

export default function IntroSound() {
  useEffect(() => {
    playIntro();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];
    const unlock = () => {
      playIntro();
      if ((window as AudioWindow).__ostadhIntroPlayed) {
        events.forEach(event => window.removeEventListener(event, unlock));
      }
    };
    events.forEach(event => window.addEventListener(event, unlock, { passive: true }));
    return () => events.forEach(event => window.removeEventListener(event, unlock));
  }, []);
  return null;
}
