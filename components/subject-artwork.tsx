"use client";

const GROUPS: Record<string, string> = {
  history: "history", geography: "geography", "social-studies": "geography", citizenship: "geography",
  mathematics: "math", physics: "science", chemistry: "science", biology: "science", science: "science", "earth-science": "science",
  "critical-thinking": "thinking", arabic: "language", english: "language",
  "digital-technology": "technology", "computer-science": "technology",
  "islamic-studies": "islamic", quran: "islamic", tafsir: "islamic", hadith: "islamic", fiqh: "islamic", tawhid: "islamic",
  art: "art", "physical-education": "sport", "health-education": "sport",
};

export default function SubjectArtwork({ subjectKey, compact = false }: { subjectKey?: string; compact?: boolean }) {
  const group = GROUPS[subjectKey || ""] || "education";
  return (
    <div className={`subject-artwork subject-artwork-${group} ${compact ? "compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 420 260" role="img">
        <defs>
          <linearGradient id={`g-${group}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity=".92" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".35" />
          </linearGradient>
          <filter id={`glow-${group}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle className="art-orbit orbit-a" cx="210" cy="130" r="94" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="2" />
        <circle className="art-orbit orbit-b" cx="210" cy="130" r="67" fill="none" stroke="currentColor" strokeOpacity=".17" strokeWidth="1.5" strokeDasharray="7 10" />
        {group === "history" && <>
          <path className="art-main" d="M112 188h196M132 174h156M150 102h120l30 24H120zM145 132v42M180 132v42M215 132v42M250 132v42" fill="none" stroke="url(#g-history)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow-history)"/>
          <path className="art-float f1" d="M82 74h40v28H82z" fill="none" stroke="currentColor" strokeWidth="5"/><path className="art-float f2" d="M302 64l18 18-18 18-18-18z" fill="none" stroke="currentColor" strokeWidth="5"/>
        </>}
        {group === "geography" && <>
          <circle className="art-main" cx="210" cy="128" r="66" fill="none" stroke="url(#g-geography)" strokeWidth="9" filter="url(#glow-geography)"/>
          <path className="art-main" d="M210 62c-25 18-38 41-38 66s13 48 38 66M210 62c25 18 38 41 38 66s-13 48-38 66M145 128h130M158 92h104M158 164h104" fill="none" stroke="currentColor" strokeOpacity=".65" strokeWidth="4"/>
          <path className="art-float f1" d="M96 78l28-13 18 18-15 31-29-8z" fill="none" stroke="currentColor" strokeWidth="5"/>
        </>}
        {group === "math" && <>
          <path className="art-main" d="M128 164l55-82 55 82zM250 82v84M208 124h84" fill="none" stroke="url(#g-math)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow-math)"/>
          <circle className="art-float f1" cx="96" cy="86" r="18" fill="none" stroke="currentColor" strokeWidth="5"/><path className="art-float f2" d="M318 178l25-25M318 153l25 25" stroke="currentColor" strokeWidth="5"/>
        </>}
        {group === "science" && <>
          <path className="art-main" d="M180 68h60M192 68v52l-45 72h126l-45-72V68M167 156h86" fill="none" stroke="url(#g-science)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow-science)"/>
          <circle className="art-bubble b1" cx="196" cy="150" r="8" fill="currentColor"/><circle className="art-bubble b2" cx="225" cy="168" r="6" fill="currentColor"/><circle className="art-bubble b3" cx="242" cy="143" r="5" fill="currentColor"/>
        </>}
        {group === "thinking" && <>
          <path className="art-main" d="M169 171c-27-17-40-42-33-68 8-30 34-50 67-50 39 0 70 28 70 65 0 27-15 48-38 60v22h-60v-22c-2-2-4-4-6-7z" fill="none" stroke="url(#g-thinking)" strokeWidth="9" strokeLinecap="round" filter="url(#glow-thinking)"/>
          <path className="art-main" d="M176 113h68M184 139h52" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
          <path className="art-float f1" d="M104 90l18 18-18 18-18-18z" fill="none" stroke="currentColor" strokeWidth="5"/>
        </>}
        {group === "language" && <>
          <path className="art-main" d="M120 180l55-20 90-90 28 28-90 90-55 20zM239 96l28 28" fill="none" stroke="url(#g-language)" strokeWidth="9" strokeLinejoin="round" filter="url(#glow-language)"/>
          <path className="art-float f1" d="M100 76h76M100 98h54" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
        </>}
        {group === "technology" && <>
          <rect className="art-main" x="130" y="65" width="160" height="126" rx="18" fill="none" stroke="url(#g-technology)" strokeWidth="9" filter="url(#glow-technology)"/>
          <path className="art-main" d="M165 112h90M165 142h60M184 191v24M236 191v24M164 215h112" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
          <circle className="art-bubble b1" cx="316" cy="88" r="7" fill="currentColor"/>
        </>}
        {group === "islamic" && <>
          <path className="art-main" d="M210 58c-28 18-46 50-46 84 0 30 15 57 39 74h14c24-17 39-44 39-74 0-34-18-66-46-84z" fill="none" stroke="url(#g-islamic)" strokeWidth="9" filter="url(#glow-islamic)"/>
          <path className="art-main" d="M210 88v90M184 134h52" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
          <circle className="art-float f2" cx="307" cy="80" r="15" fill="none" stroke="currentColor" strokeWidth="5"/>
        </>}
        {group === "art" && <>
          <path className="art-main" d="M145 176c0-57 36-104 80-104 43 0 78 33 78 73 0 21-13 33-34 33h-19c-9 0-15 7-15 15 0 13-11 23-25 23-36 0-65-18-65-40z" fill="none" stroke="url(#g-art)" strokeWidth="9" filter="url(#glow-art)"/>
          <circle cx="190" cy="112" r="8" fill="currentColor"/><circle cx="222" cy="96" r="8" fill="currentColor"/><circle cx="253" cy="114" r="8" fill="currentColor"/>
        </>}
        {group === "sport" && <>
          <circle className="art-main" cx="210" cy="130" r="66" fill="none" stroke="url(#g-sport)" strokeWidth="9" filter="url(#glow-sport)"/>
          <path className="art-main" d="M210 64l28 22-10 32-36 0-10-32zM144 130l38-12M276 130l-38-12M175 178l17-60M245 178l-17-60" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
        </>}
        {group === "education" && <>
          <path className="art-main" d="M116 94l94-42 94 42-94 42zM148 116v54c31 22 93 22 124 0v-54M304 94v64" fill="none" stroke="url(#g-education)" strokeWidth="9" strokeLinejoin="round" filter="url(#glow-education)"/>
        </>}
      </svg>
    </div>
  );
}
