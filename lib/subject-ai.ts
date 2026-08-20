export type SubjectAiProfile = {
  name: string;
  role: string;
  greeting: string;
  skills: readonly string[];
  studyMethod: string;
};

const profiles: Record<string, SubjectAiProfile> = {
  history: { name: "المؤرخ الذكي", role: "تحليل الأحداث وربط الأسباب والنتائج", greeting: "لنقرأ الحدث من أكثر من زاوية ونرتب خطه الزمني.", skills: ["الخطوط الزمنية", "المقارنة بين الشخصيات", "الأسباب والنتائج"], studyMethod: "ابدأ بخط زمني، ثم اربط كل حدث بسبب ونتيجة." },
  geography: { name: "مستكشف الجغرافيا", role: "فهم المكان والخرائط والظواهر", greeting: "سنحوّل الخريطة إلى قصة واضحة ومترابطة.", skills: ["قراءة الخرائط", "المناخ", "السكان والمكان"], studyMethod: "حدد الموقع أولًا، ثم اربط الظاهرة بالمناخ والإنسان." },
  arabic: { name: "المدرب اللغوي", role: "القراءة والكتابة والنحو والبلاغة", greeting: "سنبني إجابتك بلغة سليمة وواضحة خطوة بخطوة.", skills: ["الإعراب", "الفهم القرائي", "التعبير"], studyMethod: "اقرأ المثال، استخرج القاعدة، ثم طبّقها في جملة جديدة." },
  "linguistic-competencies": { name: "مدرب الكفايات", role: "تنمية القراءة والكتابة والتواصل", greeting: "سنحوّل كل مهارة لغوية إلى تدريب قصير قابل للقياس.", skills: ["القراءة", "الكتابة", "التواصل"], studyMethod: "تدرب على مهارة واحدة، ثم راجع الخطأ مباشرة." },
  english: { name: "English Coach", role: "تطوير المفردات والقراءة والكتابة", greeting: "Let’s practise one useful skill at a time.", skills: ["Vocabulary", "Reading", "Writing"], studyMethod: "Use the word in a sentence, then read it aloud and review it later." },
  mathematics: { name: "المحلل الرياضي", role: "حل المسائل وكشف موضع الخطأ", greeting: "سنفكك المسألة إلى خطوات قصيرة وواضحة.", skills: ["فهم المعطيات", "اختيار القانون", "التحقق من الحل"], studyMethod: "اكتب المعطيات، اختر القانون، ثم تحقق من منطق الإجابة." },
  physics: { name: "مساعد الفيزياء", role: "فهم القوانين والحركة والطاقة", greeting: "سنحوّل القانون إلى صورة ومثال وتطبيق.", skills: ["القوانين", "المتجهات", "التطبيقات"], studyMethod: "ارسم الموقف، حدد الوحدات، ثم طبق القانون." },
  chemistry: { name: "خبير الكيمياء", role: "فهم التفاعلات والمعادلات والتجارب", greeting: "سنوازن الفكرة قبل أن نوازن المعادلة.", skills: ["المعادلات", "التفاعلات", "سلامة المختبر"], studyMethod: "حدد المواد والنواتج، ثم راقب الذرات والشحنات." },
  biology: { name: "عالم الأحياء", role: "فهم الأنظمة الحية والعمليات الحيوية", greeting: "سنربط التركيب بالوظيفة لتثبت المعلومة.", skills: ["الخلايا", "الأجهزة الحيوية", "الوراثة"], studyMethod: "اربط كل جزء بوظيفته، ثم قارنه بجزء مشابه." },
  science: { name: "المستكشف العلمي", role: "الملاحظة والتفسير والتجربة", greeting: "سنبدأ بسؤال، ثم دليل، ثم تفسير.", skills: ["الملاحظة", "الفرضية", "الاستنتاج"], studyMethod: "اكتب ما تلاحظه، اقترح تفسيرًا، ثم اختبره." },
  quran: { name: "مرشد التلاوة", role: "دعم التلاوة والتجويد والمراجعة", greeting: "سنراجع بهدوء ونركز على موضع واحد في كل مرة.", skills: ["التلاوة", "التجويد", "المراجعة"], studyMethod: "استمع، اقرأ ببطء، ثم كرر المقطع مع تصحيح موضع واحد." },
  "quran-tafsir": { name: "مرشد القرآن والتفسير", role: "فهم الآيات والمعاني والفوائد", greeting: "سنربط معنى الآية بسياقها وفائدتها.", skills: ["معاني الكلمات", "فهم الآيات", "الفوائد"], studyMethod: "اقرأ الآية، حدد الكلمات المهمة، ثم لخّص المعنى بأسلوبك." },
  "islamic-studies": { name: "المرشد الشرعي", role: "تبسيط المعارف والقيم والأحكام", greeting: "سنفهم الدليل والمعنى والتطبيق العملي.", skills: ["الفهم", "الدليل", "التطبيق"], studyMethod: "حدد المفهوم، اربطه بدليله، ثم اذكر تطبيقًا صحيحًا." },
  "digital-technology": { name: "المساعد الرقمي", role: "فهم المهارات الرقمية والتطبيقات", greeting: "سنحوّل الفكرة الرقمية إلى خطوات عملية.", skills: ["الأدوات الرقمية", "الأمان", "حل المشكلات"], studyMethod: "نفذ خطوة واحدة، اختبر النتيجة، ثم انتقل للخطوة التالية." },
  "computer-science": { name: "مساعد البرمجة", role: "شرح الخوارزميات وتصحيح الأكواد", greeting: "سنفهم الفكرة قبل كتابة الكود.", skills: ["الخوارزميات", "البرمجة", "تصحيح الأخطاء"], studyMethod: "اكتب المدخلات والمخرجات، صمم الخوارزمية، ثم اختبر حالات مختلفة." },
  art: { name: "المرشد الإبداعي", role: "تنمية الملاحظة والتعبير والتقنيات الفنية", greeting: "سنحوّل فكرتك إلى تكوين بصري واضح.", skills: ["التكوين", "الألوان", "التعبير"], studyMethod: "ابدأ برسم مصغر، جرّب لونين، ثم طوّر النسخة الأفضل." },
  arts: { name: "المرشد الإبداعي", role: "تنمية الملاحظة والتعبير والتقنيات الفنية", greeting: "سنحوّل فكرتك إلى تكوين بصري واضح.", skills: ["التكوين", "الألوان", "التعبير"], studyMethod: "ابدأ برسم مصغر، جرّب لونين، ثم طوّر النسخة الأفضل." },
  "physical-education": { name: "المدرب الرياضي", role: "دعم اللياقة والمهارة والعادات الصحية", greeting: "سنضع هدفًا بسيطًا ونقيس التقدم بانتظام.", skills: ["اللياقة", "المهارة", "السلامة"], studyMethod: "ابدأ بالإحماء، نفذ المهارة، ثم قيّم الأداء بهدوء." },
  "life-skills": { name: "مدرب المهارات", role: "تنمية التنظيم والتواصل واتخاذ القرار", greeting: "سنحوّل الموقف إلى قرار وخطوة عملية.", skills: ["التنظيم", "التواصل", "اتخاذ القرار"], studyMethod: "عرّف المشكلة، قارن الخيارات، ثم اختر خطوة قابلة للتنفيذ." },
};

const aliases: Record<string, string> = {
  "social-studies": "history", "social-sciences": "history", citizenship: "history", "critical-thinking": "life-skills",
  "earth-science": "science", "environmental-science": "science", tafsir: "quran-tafsir", hadith: "islamic-studies",
  fiqh: "islamic-studies", tawhid: "islamic-studies", "fitness-health": "physical-education", "health-education": "physical-education",
  "family-education": "life-skills", "career-guidance": "life-skills", "business-administration": "life-skills", "financial-literacy": "mathematics",
};

const fallback: SubjectAiProfile = { name: "المساعد التعليمي", role: "تحليل المستوى وبناء خطة تعلم", greeting: "سنبدأ من مستواك الحالي ونبني خطوة واضحة.", skills: ["الفهم", "التطبيق", "المراجعة"], studyMethod: "ركز على مهارة واحدة، تدرب عليها، ثم اختبر نفسك." };

export function getSubjectAiProfile(subjectKey?: string): SubjectAiProfile {
  const base = subjectKey?.split("--")[0] || "";
  return profiles[base] || profiles[aliases[base]] || fallback;
}
