"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import PortalVoiceGreeting from "../lib/portal-voice-greeting";

type GreetingIdentity = {
  role: "teacher" | "student";
  name: string;
  identityKey: string;
};

function textOf(selector: string) {
  return String(document.querySelector(selector)?.textContent || "").trim();
}

function detectIdentity(pathname: string): GreetingIdentity | null {
  if (pathname.startsWith("/teacher") && document.querySelector(".teacher-academy-v12")) {
    const name = textOf(".academy-v12-profile-copy h2");
    const safeName = name && name !== "المعلم" ? name : "";
    return { role: "teacher", name: safeName, identityKey: `teacher:${safeName || "active"}` };
  }

  if (pathname.startsWith("/student") && document.querySelector(".student-academy-v4")) {
    const name = textOf(".sta4-id strong") || textOf(".sta4-student strong");
    const code = textOf(".sta4-id code");
    const safeName = name && name !== "الطالب" ? name : "";
    return { role: "student", name: safeName, identityKey: `student:${code || safeName || "active"}` };
  }

  return null;
}

function chooseArabicVoice(voices: SpeechSynthesisVoice[]) {
  const arabic = voices.filter(voice => /^ar(?:-|$)/i.test(voice.lang));
  return arabic.find(voice => /sa/i.test(voice.lang))
    || arabic.find(voice => /female|natural|microsoft|google/i.test(voice.name))
    || arabic[0]
    || null;
}

function speakLoginGreeting(role: "teacher" | "student") {
  if (typeof window === "undefined") return;

  const phrase = role === "teacher"
    ? "مرحبًا أستاذ. أهلًا بك في بوابة أستاذ لحوني التعليمية."
    : "مرحبًا بك. أهلًا بك في بوابة أستاذ لحوني التعليمية، ونتمنى لك يومًا دراسيًا موفقًا.";

  // Android application bridge when the installed app exposes native TTS.
  try {
    if (window.OstadhTts?.speakArabic) {
      window.OstadhTts.speakArabic(phrase);
      return;
    }
  } catch {}

  // IMPORTANT: the real utterance is started synchronously from the login gesture.
  // iOS Safari/PWA and many Android WebViews do not preserve audio permission after async login completes.
  try {
    if ("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = "ar-SA";
      utterance.volume = 1;
      utterance.rate = 0.94;
      utterance.pitch = 1;
      const voice = chooseArabicVoice(window.speechSynthesis.getVoices());
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    }
  } catch {}

  // Also unlock WebAudio for browsers that require an active audio context.
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextCtor) {
      const context = new AudioContextCtor();
      if (context.state === "suspended") void context.resume();
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
      source.onended = () => void context.close();
    }
  } catch {}

  try { sessionStorage.setItem("ostadh-voice-unlocked", String(Date.now())); } catch {}
}

export default function PortalVoiceGreetingRuntime() {
  const pathname = usePathname();
  const [identity, setIdentity] = useState<GreetingIdentity | null>(null);

  useEffect(() => {
    const isTeacherLogin = pathname === "/teacher";
    const isStudentLogin = pathname === "/student" || pathname === "/";
    if (!isTeacherLogin && !isStudentLogin) return;

    const role: "teacher" | "student" = isTeacherLogin ? "teacher" : "student";
    const onGesture = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button,input[type='submit']") as HTMLElement | null;
      const form = target.closest("form");
      const label = String(button?.textContent || button?.getAttribute("value") || "").trim();
      const looksLikeLogin = Boolean(form) && (
        /دخول|تسجيل|فتح الأكاديمية|الدخول/i.test(label)
        || isTeacherLogin
        || isStudentLogin
      );
      if (looksLikeLogin) speakLoginGreeting(role);
    };

    const onSubmit = () => speakLoginGreeting(role);
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("touchstart", onGesture, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("touchstart", onGesture, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setIdentity(detectIdentity(pathname)));
    };

    update();
    timeout = window.setTimeout(update, 900);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("pageshow", update);
    window.addEventListener("focus", update);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("focus", update);
    };
  }, [pathname]);

  if (!identity) return null;

  const wrapperStyle: CSSProperties = {
    position: "fixed",
    left: "max(14px, env(safe-area-inset-left))",
    bottom: "max(14px, env(safe-area-inset-bottom))",
    zIndex: 2147483000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return <div style={wrapperStyle} data-portal-voice-greeting>
    <PortalVoiceGreeting role={identity.role} name={identity.name} identityKey={identity.identityKey} compact />
  </div>;
}
