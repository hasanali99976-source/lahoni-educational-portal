from pathlib import Path

page_path = Path('app/teacher/portfolio/page.tsx')
css_path = Path('app/teacher/portfolio/portfolio.css')
sw_path = Path('public/sw.js')

page = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')

state_anchor = '  const [loaded, setLoaded] = useState(false);\n  const addPanelRef = useRef<HTMLElement | null>(null);'
state_replacement = '  const [loaded, setLoaded] = useState(false);\n  const [previewOpen, setPreviewOpen] = useState(false);\n  const addPanelRef = useRef<HTMLElement | null>(null);'
if state_anchor not in page:
    raise SystemExit('state anchor missing')
page = page.replace(state_anchor, state_replacement, 1)

start = page.index('  function printPortfolio() {')
end = page.index('\n\n  return (', start)
new_functions = r'''  function openPortfolioPreview() {
    if (!achievements.length) {
      setMessage("أضف إنجازًا واحدًا على الأقل، ثم افتح ملف الإنجاز.");
      return;
    }
    setMessage("");
    setPreviewOpen(true);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(".portfolio-preview-toolbar")?.focus();
    }, 120);
  }

  async function printPortfolio() {
    if (!achievements.length) {
      setMessage("أضف إنجازًا واحدًا على الأقل، ثم أخرج ملف الإنجاز.");
      return;
    }

    const nativeWindow = window as typeof window & {
      OstadhApp?: { printPage?: (title: string) => void };
      ostadhNativePrint?: (title?: string) => boolean;
      __OSTADH_ANDROID__?: boolean;
    };
    const previousTitle = document.title;
    const printTitle = `ملف إنجاز ${session?.teacherName || "المعلم"}`;
    const restoreTitle = () => {
      document.documentElement.classList.remove("portfolio-print-active");
      document.title = previousTitle;
    };

    document.title = printTitle;
    document.documentElement.classList.add("portfolio-print-active");
    setMessage("جارٍ تجهيز صفحات الإنجاز وإرسالها إلى شاشة الإخراج...");

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".portfolio-print-document img"));
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 1800);
      });
    }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 450));

    try {
      if (nativeWindow.OstadhApp?.printPage) {
        nativeWindow.OstadhApp.printPage(printTitle);
        setMessage("فُتحت شاشة الإخراج. اختر الطابعة أو الحفظ بصيغة PDF.");
        window.setTimeout(restoreTitle, 20000);
        return;
      }

      if (typeof nativeWindow.ostadhNativePrint === "function") {
        const opened = nativeWindow.ostadhNativePrint(printTitle);
        if (opened !== false) {
          setMessage("فُتحت شاشة الإخراج. اختر الطابعة أو الحفظ بصيغة PDF.");
          window.setTimeout(restoreTitle, 20000);
          return;
        }
      }

      window.addEventListener("afterprint", restoreTitle, { once: true });
      window.focus();
      window.print();
      setMessage("فُتحت شاشة الإخراج. اختر الطابعة أو الحفظ بصيغة PDF.");
      window.setTimeout(restoreTitle, 20000);
    } catch {
      if (/OstadhLahooniAndroid/i.test(navigator.userAgent) || nativeWindow.__OSTADH_ANDROID__) {
        try {
          window.location.assign(`ostadh://print?title=${encodeURIComponent(printTitle)}`);
          setMessage("تم إرسال ملف الإنجاز إلى التطبيق.");
        } catch {
          setMessage("تعذر فتح شاشة الإخراج داخل التطبيق. أبقِ المعاينة مفتوحة ثم أعد المحاولة.");
        }
      } else {
        setMessage("تعذر فتح شاشة الإخراج. افتح البوابة في Chrome ثم أعد المحاولة.");
      }
      window.setTimeout(restoreTitle, 20000);
    }
  }'''
page = page[:start] + new_functions + page[end:]

page = page.replace('<main className="portfolio-page" dir="rtl">', '<main className={`portfolio-page${previewOpen ? " portfolio-preview-open" : ""}`} dir="rtl">', 1)

old_button = '''          <button
            type="button"
            className="print-portfolio-button"
            onClick={printPortfolio}
            aria-label="إخراج ملف الإنجاز للطباعة أو الحفظ بصيغة PDF"
          >
            إخراج ملف الإنجاز PDF
          </button>'''
new_button = '''          <button
            type="button"
            className="print-portfolio-button"
            onClick={openPortfolioPreview}
            aria-label="معاينة ملف الإنجاز قبل إخراجه"
          >
            معاينة ملف الإنجاز وإخراجه
          </button>'''
if old_button not in page:
    raise SystemExit('button anchor missing')
page = page.replace(old_button, new_button, 1)

old_document = '<section className="portfolio-print-document print-only" aria-hidden="true">\n        <section className="portfolio-print-cover print-page">'
new_document = '''<section id="portfolio-print-preview" className="portfolio-print-document print-only" aria-hidden={!previewOpen}>
        <div className="portfolio-preview-toolbar no-print" tabIndex={-1}>
          <div>
            <span>معاينة ملف الإنجاز</span>
            <strong>{arabicNumber(achievements.length + 4)} صفحات احترافية جاهزة</strong>
          </div>
          <div>
            <button type="button" className="preview-back" onClick={() => setPreviewOpen(false)}>العودة والتعديل</button>
            <button type="button" className="preview-print" onClick={printPortfolio}>إخراج النسخة النهائية PDF</button>
          </div>
        </div>
        <section className="portfolio-print-cover print-page">'''
if old_document not in page:
    raise SystemExit('document anchor missing')
page = page.replace(old_document, new_document, 1)

old_cover_center = '''          <div className="print-cover-center">
            <span>ملف إنجاز مهني إلكتروني</span>
            <h1>ملف الإنجاز المهني للمعلم</h1>
            <p>توثيق الممارسات والمبادرات والشواهد والأثر التعليمي</p>
          </div>'''
new_cover_center = '''          <div className="print-cover-center">
            <div className="print-cover-seal">
              <span>سجل مهني</span>
              <strong>إنجاز</strong>
              <small>{arabicNumber(achievements.length)} أثر موثق</small>
            </div>
            <span className="print-cover-eyebrow">إنجازات تصنع أثرًا</span>
            <h1>ملف الإنجاز المهني للمعلم</h1>
            <p>قصة مهنية موثقة تجمع المبادرات والممارسات والشواهد والأثر التعليمي في مشروع واحد متكامل.</p>
            <div className="print-cover-badges"><b>ابتكار</b><b>أثر</b><b>تطوير</b><b>توثيق</b></div>
          </div>'''
if old_cover_center not in page:
    raise SystemExit('cover anchor missing')
page = page.replace(old_cover_center, new_cover_center, 1)

stats_anchor = '''          <div className="print-stat-grid">
            <article><strong>{arabicNumber(achievements.length)}</strong><span>إنجاز موثق</span></article>
            <article><strong>{arabicNumber(summary.files + summary.links)}</strong><span>شاهد مرفق</span></article>
            <article><strong>{arabicNumber(Object.keys(summary.categories).length)}</strong><span>مجال مهني</span></article>
            <article><strong>{arabicNumber(summary.months)}</strong><span>أشهر موثقة</span></article>
          </div>'''
stats_replacement = stats_anchor + '''
          <div className="print-impact-banner">
            <span>بصمة الإنجاز</span>
            <strong>{achievements.length ? `مسار مهني يبرز قوته في ${summary.topCategory}` : "مسار مهني قيد البناء"}</strong>
            <small>كل إنجاز موثق يتحول تلقائيًا إلى صفحة أثر داخل هذا الملف.</small>
          </div>'''
page = page.replace(stats_anchor, stats_replacement, 1)

category_anchor = '''          <div className="print-category-map">
            {(Object.entries(summary.categories) as Array<[string, number]>).map(([category, count]) => <span key={category}>{category}<b>{arabicNumber(count)}</b></span>)}
          </div>'''
category_replacement = category_anchor + '''
          <div className="print-category-bars">
            {(Object.entries(summary.categories) as Array<[string, number]>).map(([category, count]) => {
              const width = Math.max(18, Math.round((count / Math.max(1, achievements.length)) * 100));
              return <div key={category}><span>{category}</span><i><b style={{ width: `${width}%` }} /></i><strong>{arabicNumber(count)}</strong></div>;
            })}
          </div>'''
page = page.replace(category_anchor, category_replacement, 1)

old_achievement_header = '''            <header>
              <div className="print-achievement-number">{arabicNumber(index + 1)}</div>
              <div><span>{item.category}</span><h2>{item.title}</h2><time>{formatDate(item.date)}</time></div>
            </header>'''
new_achievement_header = '''            <header>
              <div className="print-achievement-number">{arabicNumber(index + 1)}</div>
              <div><span>{item.category}</span><h2>{item.title}</h2><time>{formatDate(item.date)}</time></div>
              <div className="print-achievement-stamp"><span>أثر</span><strong>موثّق</strong></div>
            </header>'''
if old_achievement_header not in page:
    raise SystemExit('achievement header missing')
page = page.replace(old_achievement_header, new_achievement_header, 1)

image_anchor = '            {item.fileData.startsWith("data:image/") && <img className="print-achievement-image" src={item.fileData} alt={item.title} />}\n            <div className="print-achievement-content">'
image_replacement = '''            {item.fileData.startsWith("data:image/") && <img className="print-achievement-image" src={item.fileData} alt={item.title} />}
            <div className="print-achievement-tags">{(item.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="print-achievement-content">'''
if image_anchor not in page:
    raise SystemExit('image anchor missing')
page = page.replace(image_anchor, image_replacement, 1)

page = page.replace('<h2>ملف مهني موثق ومنظم إلكترونيًا</h2>', '<h2>إنجازات تصنع أثرًا مستدامًا</h2>', 1)
page = page.replace('يضم هذا الملف الإنجازات والشواهد التي أضافها المعلم، وقد جرى تصنيفها وصياغتها وترتيبها في صورة ملف إنجاز متكامل.', 'يقدم هذا الملف قصة مهنية متكاملة للإنجازات والشواهد والأثر، جرى بناؤها وتصنيفها وترتيبها إلكترونيًا لتظهر قيمة العمل التعليمي بوضوح وقوة.', 1)

marker = '/* v50: visible premium portfolio preview and reliable native printing */'
if marker in css:
    css = css.split(marker)[0].rstrip() + '\n'

css += r'''

/* v50: visible premium portfolio preview and reliable native printing */
.portfolio-preview-open .portfolio-print-document{
  display:block!important;
  position:fixed!important;
  inset:0!important;
  z-index:999999!important;
  overflow:auto!important;
  padding:86px 14px 34px!important;
  background:
    radial-gradient(circle at 12% 8%,rgba(28,139,145,.14),transparent 24%),
    radial-gradient(circle at 88% 22%,rgba(240,184,74,.18),transparent 25%),
    linear-gradient(145deg,#dfe9ed,#f6f8f9 45%,#dbe8e8)!important;
  color:#142f40;
}
.portfolio-preview-toolbar{
  position:fixed;
  top:0;
  right:0;
  left:0;
  z-index:1000000;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  min-height:70px;
  padding:10px clamp(14px,4vw,42px);
  color:#fff;
  background:linear-gradient(115deg,#071f38,#0e6075 58%,#128a7c);
  box-shadow:0 10px 34px rgba(7,31,56,.25);
  outline:none;
}
.portfolio-preview-toolbar>div:first-child{display:grid;gap:2px}.portfolio-preview-toolbar span{color:#ffe09a;font-size:12px;font-weight:900}.portfolio-preview-toolbar strong{font-size:16px}
.portfolio-preview-toolbar>div:last-child{display:flex;gap:9px}
.portfolio-preview-toolbar button{min-height:44px;border:0;border-radius:13px;padding:9px 16px;font-weight:950}
.portfolio-preview-toolbar .preview-back{color:#17384b;background:#eef5f6}.portfolio-preview-toolbar .preview-print{color:#102f43;background:linear-gradient(135deg,#ffe7a3,#efb641);box-shadow:0 8px 20px rgba(0,0,0,.18)}
.portfolio-preview-open .print-page{
  position:relative;
  width:min(860px,calc(100vw - 28px));
  min-height:1100px;
  margin:18px auto;
  padding:58px 64px 52px;
  overflow:hidden;
  background:#fff;
  border-radius:5px;
  box-shadow:0 24px 70px rgba(18,52,69,.20);
}
.portfolio-preview-open .portfolio-print-cover,
.portfolio-preview-open .portfolio-print-final{display:flex!important;flex-direction:column;color:#fff;background:radial-gradient(circle at 13% 12%,rgba(255,255,255,.18),transparent 27%),radial-gradient(circle at 88% 87%,rgba(44,226,195,.30),transparent 33%),linear-gradient(140deg,#061a31 0%,#0b4f75 55%,#118879 100%)!important}
.portfolio-preview-open .portfolio-print-cover:before,.portfolio-preview-open .portfolio-print-final:before{content:"";position:absolute;inset:32px;border:1px solid rgba(255,255,255,.25);border-radius:24px}
.portfolio-preview-open .print-cover-brand{position:relative;display:flex;align-items:center;gap:18px;padding:18px 0;border-bottom:1px solid rgba(255,255,255,.22)}
.portfolio-preview-open .print-cover-brand img{width:86px;height:86px;border-radius:23px;object-fit:cover;border:5px solid rgba(255,255,255,.92);box-shadow:0 12px 28px rgba(0,0,0,.18)}
.portfolio-preview-open .print-cover-brand span{display:block;color:#fff;font-size:24px;font-weight:950}.portfolio-preview-open .print-cover-brand small{display:block;margin-top:5px;color:#d8eff0}
.portfolio-preview-open .print-cover-center{position:relative;display:grid;place-items:center;align-content:center;flex:1;text-align:center;padding:50px 20px}
.print-cover-seal{position:relative;display:grid;place-items:center;align-content:center;width:190px;height:190px;margin-bottom:28px;border:1px solid rgba(255,255,255,.32);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:0 0 0 14px rgba(255,255,255,.05),0 24px 55px rgba(0,0,0,.18)}
.print-cover-seal:before,.print-cover-seal:after{content:"";position:absolute;border-radius:50%;border:1px dashed rgba(255,226,157,.58)}.print-cover-seal:before{inset:13px}.print-cover-seal:after{inset:25px}
.print-cover-seal span,.print-cover-seal small,.print-cover-seal strong{position:relative;z-index:1}.print-cover-seal span{color:#d8eff1;font-size:13px}.print-cover-seal strong{margin:3px 0;color:#ffe19a;font-size:48px;line-height:1;font-weight:950}.print-cover-seal small{color:#fff;font-weight:900}
.portfolio-preview-open .print-cover-eyebrow{display:inline-flex;padding:8px 16px;border:1px solid rgba(255,255,255,.30);border-radius:999px;color:#ffe5a2;background:rgba(255,255,255,.09);font-weight:900}
.portfolio-preview-open .print-cover-center h1{max-width:640px;margin:20px 0 12px;color:#fff;font-size:46px;line-height:1.28}.portfolio-preview-open .print-cover-center p{max-width:650px;margin:0;color:#dceff1;font-size:18px;line-height:1.9}
.print-cover-badges{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin-top:24px}.print-cover-badges b{padding:8px 13px;border-radius:999px;color:#fff;background:rgba(255,255,255,.12);font-size:12px}
.portfolio-preview-open .portfolio-print-cover dl{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 32px}.portfolio-preview-open .portfolio-print-cover dl div{padding:16px;border:1px solid rgba(255,255,255,.20);border-radius:15px;background:rgba(255,255,255,.10)}
.portfolio-preview-open .portfolio-print-cover dt{color:#cbe8eb;font-size:12px}.portfolio-preview-open .portfolio-print-cover dd{margin:6px 0 0;color:#fff;font-size:17px;font-weight:950}.portfolio-preview-open .portfolio-print-cover>footer{position:relative;padding-top:15px;border-top:1px solid rgba(255,255,255,.18);text-align:center;color:#d3e9eb;font-size:12px}
.portfolio-preview-open .print-section-header{display:flex;align-items:center;gap:18px;margin-bottom:32px;padding-bottom:18px;border-bottom:4px solid #137c82}.portfolio-preview-open .print-section-header>span{width:58px;height:58px;display:grid;place-items:center;border-radius:19px;color:#fff;background:linear-gradient(135deg,#0b4169,#15928b);font-size:20px;font-weight:950}.portfolio-preview-open .print-section-header small{display:block;color:#5c7885}.portfolio-preview-open .print-section-header h2{margin:3px 0 0;color:#10364d;font-size:34px}
.portfolio-preview-open .print-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}.portfolio-preview-open .print-stat-grid article{padding:19px 12px;text-align:center;border:1px solid #d3e4e8;border-radius:16px;background:linear-gradient(145deg,#f8fbfb,#edf6f6)}.portfolio-preview-open .print-stat-grid strong{display:block;color:#0b6174;font-size:36px}.portfolio-preview-open .print-stat-grid span{color:#587581;font-size:12px}
.print-impact-banner{display:grid;gap:4px;margin:0 0 24px;padding:20px 22px;border-radius:18px;color:#fff;background:linear-gradient(120deg,#0b395d,#0e7e82 70%,#15967e);box-shadow:0 14px 34px rgba(13,102,111,.20)}.print-impact-banner span{color:#ffe09b;font-size:12px;font-weight:900}.print-impact-banner strong{font-size:20px}.print-impact-banner small{color:#d9eff0}
.portfolio-preview-open .print-narrative{margin:0 0 15px;padding:20px 22px;border-right:6px solid #159092;border-radius:14px;background:#f5fafb}.portfolio-preview-open .print-narrative h3,.portfolio-preview-open .portfolio-print-reflection article h3,.portfolio-preview-open .print-achievement-content h3{margin:0 0 9px;color:#0d6573}.portfolio-preview-open .print-narrative p,.portfolio-preview-open .portfolio-print-reflection article p,.portfolio-preview-open .print-achievement-content p{margin:0;line-height:1.95;text-align:justify}
.portfolio-preview-open .print-index-list{display:grid;gap:9px}.portfolio-preview-open .print-index-list>div{display:grid;grid-template-columns:42px 1fr 150px 130px;align-items:center;gap:11px;padding:12px 14px;border:1px solid #dbe7eb;border-radius:12px;background:#fbfdfd}.portfolio-preview-open .print-index-list>div>span{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;color:#fff;background:#146e7d;font-weight:900}.portfolio-preview-open .print-index-list small,.portfolio-preview-open .print-index-list time{color:#607b88;font-size:12px}
.portfolio-preview-open .print-category-map,.portfolio-preview-open .print-strengths>div{display:flex;flex-wrap:wrap;gap:9px;margin-top:25px}.portfolio-preview-open .print-category-map span,.portfolio-preview-open .print-strengths span{display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:999px;background:#eaf4f4;color:#285769;font-size:12px;font-weight:900}.portfolio-preview-open .print-category-map b,.portfolio-preview-open .print-strengths b{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;color:#fff;background:#127a82}
.print-category-bars{display:grid;gap:10px;margin-top:24px;padding:20px;border:1px solid #dce8eb;border-radius:16px;background:#f8fbfb}.print-category-bars>div{display:grid;grid-template-columns:145px 1fr 30px;align-items:center;gap:11px}.print-category-bars span{color:#34596c;font-size:12px;font-weight:900}.print-category-bars i{height:9px;overflow:hidden;border-radius:999px;background:#dce9eb}.print-category-bars i b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#147084,#19a382)}.print-category-bars strong{color:#0d6472;text-align:center}
.portfolio-preview-open .portfolio-print-achievement{display:flex!important;flex-direction:column}.portfolio-preview-open .portfolio-print-achievement>header{display:grid;grid-template-columns:72px 1fr auto;align-items:center;gap:18px;margin-bottom:25px;padding-bottom:18px;border-bottom:4px solid #147983}.portfolio-preview-open .print-achievement-number{width:68px;height:68px;display:grid;place-items:center;border-radius:22px;color:#fff;background:linear-gradient(135deg,#0b3d65,#16918e);font-size:26px;font-weight:950}.portfolio-preview-open .portfolio-print-achievement>header span{display:inline-block;margin-bottom:5px;color:#147b83;font-weight:900}.portfolio-preview-open .portfolio-print-achievement>header h2{margin:0 0 5px;color:#11364b;font-size:31px;line-height:1.35}.portfolio-preview-open .portfolio-print-achievement>header time{color:#6b818d;font-size:12px}
.print-achievement-stamp{display:grid!important;place-items:center!important;align-content:center!important;width:88px;height:88px;border:2px solid #d5a53d;border-radius:50%;transform:rotate(-7deg);background:#fff9e9!important;box-shadow:inset 0 0 0 5px #fff,0 8px 18px rgba(117,81,14,.12)}.print-achievement-stamp span{margin:0!important;color:#9b6c16!important;font-size:11px!important}.print-achievement-stamp strong{color:#8e6012;font-size:18px}
.portfolio-preview-open .print-achievement-image{display:block;width:100%;max-height:430px;margin:0 auto 18px;border:1px solid #d9e5e8;border-radius:18px;object-fit:contain;background:#f5f8f9}.print-achievement-tags{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 18px}.print-achievement-tags span{padding:7px 10px;border-radius:999px;color:#146b76;background:#e9f5f3;font-size:11px;font-weight:900}
.portfolio-preview-open .print-achievement-content{display:grid;grid-template-columns:1fr 1fr;gap:13px}.portfolio-preview-open .print-achievement-content article{padding:17px 18px;border:1px solid #dce8eb;border-radius:15px;background:#fbfdfd}.portfolio-preview-open .print-achievement-content article.impact{grid-column:1/-1;border-color:#b9ded9;background:#eff9f6}.portfolio-preview-open .print-evidence-reference{display:flex;align-items:flex-start;flex-wrap:wrap;gap:8px 15px;margin-top:18px;padding:14px 16px;border:1px dashed #9ebfc6;border-radius:13px;color:#405e6d;background:#f8fbfb;word-break:break-all}.portfolio-preview-open .print-evidence-reference a{width:100%;color:#126f7a;text-decoration:none}.portfolio-preview-open .portfolio-print-achievement>footer{margin-top:auto;padding-top:20px;border-top:1px solid #e0e9ec;text-align:center;color:#78909b;font-size:11px}
.portfolio-preview-open .portfolio-print-reflection article{margin-bottom:20px;padding:24px;border:1px solid #d5e4e8;border-radius:18px;background:#f8fbfc}.portfolio-preview-open .print-strengths{margin-top:28px;padding:22px;border-radius:18px;color:#fff;background:linear-gradient(135deg,#103d60,#157e80)}.portfolio-preview-open .print-strengths h3{margin:0;color:#fff}.portfolio-preview-open .print-strengths span{background:rgba(255,255,255,.13);color:#fff}.portfolio-preview-open .print-strengths b{background:#f1bd52;color:#15394e}
.portfolio-preview-open .portfolio-print-final{align-items:center;justify-content:center;text-align:center}.portfolio-preview-open .portfolio-print-final>img{position:relative;width:128px;height:128px;border-radius:36px;border:8px solid rgba(255,255,255,.92);box-shadow:0 18px 40px rgba(0,0,0,.18)}.portfolio-preview-open .portfolio-print-final>span{position:relative;margin-top:32px;color:#ffe3a0;font-weight:900}.portfolio-preview-open .portfolio-print-final>h2{position:relative;margin:14px 0;color:#fff;font-size:42px}.portfolio-preview-open .portfolio-print-final>p{position:relative;max-width:650px;margin:0;color:#d9eff0;font-size:18px;line-height:1.9}.portfolio-preview-open .print-signatures{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:18px;width:100%;margin-top:54px}.portfolio-preview-open .print-signatures>div{display:grid;gap:10px;padding:24px;border:1px solid rgba(255,255,255,.20);border-radius:18px;background:rgba(255,255,255,.10)}.portfolio-preview-open .print-signatures small{color:#c9e7e9}.portfolio-preview-open .print-signatures strong{color:#fff;font-size:19px}.portfolio-preview-open .print-signatures span{margin-top:20px;color:#e4f1f2}.portfolio-preview-open .portfolio-print-final>footer{position:absolute;right:58px;left:58px;bottom:48px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18);color:#cae4e6}
@media(max-width:720px){.portfolio-preview-toolbar{align-items:stretch;flex-direction:column;padding:9px 12px}.portfolio-preview-toolbar>div:last-child{display:grid;grid-template-columns:1fr 1fr}.portfolio-preview-open .portfolio-print-document{padding-top:126px!important}.portfolio-preview-open .print-page{min-height:auto;padding:30px 20px}.portfolio-preview-open .print-cover-brand img{width:64px;height:64px}.portfolio-preview-open .print-cover-brand span{font-size:18px}.print-cover-seal{width:145px;height:145px}.print-cover-seal strong{font-size:37px}.portfolio-preview-open .print-cover-center h1{font-size:32px}.portfolio-preview-open .print-cover-center p{font-size:15px}.portfolio-preview-open .portfolio-print-cover dl,.portfolio-preview-open .print-stat-grid,.portfolio-preview-open .print-achievement-content,.portfolio-preview-open .print-signatures{grid-template-columns:1fr 1fr}.portfolio-preview-open .print-index-list>div{grid-template-columns:38px 1fr}.portfolio-preview-open .print-index-list small,.portfolio-preview-open .print-index-list time{grid-column:2}.print-category-bars>div{grid-template-columns:110px 1fr 25px}.portfolio-preview-open .portfolio-print-achievement>header{grid-template-columns:58px 1fr}.portfolio-preview-open .print-achievement-number{width:54px;height:54px}.print-achievement-stamp{display:none!important}.portfolio-preview-open .portfolio-print-achievement>header h2{font-size:24px}}

@media print{
  html.portfolio-print-active .portfolio-print-document,
  .portfolio-page .portfolio-print-document{
    display:block!important;
    position:static!important;
    visibility:visible!important;
    opacity:1!important;
  }
  .portfolio-page .portfolio-print-document *{visibility:visible!important;opacity:1!important}
  .portfolio-preview-toolbar{display:none!important}
  .print-cover-seal{width:43mm;height:43mm;margin:0 auto 7mm;border:1px solid rgba(255,255,255,.34);border-radius:50%;box-shadow:0 0 0 4mm rgba(255,255,255,.05)}
  .print-cover-seal:before{inset:3mm}.print-cover-seal:after{inset:6mm}.print-cover-seal strong{font-size:31pt}.print-cover-seal span,.print-cover-seal small{font-size:8pt}
  .print-cover-eyebrow{display:inline-flex!important;padding:2.3mm 4mm;border:1px solid rgba(255,255,255,.30);border-radius:99mm;color:#ffe4a0!important;background:rgba(255,255,255,.09);font-size:9pt;font-weight:900}
  .print-cover-badges{display:flex;flex-wrap:wrap;justify-content:center;gap:2mm;margin-top:6mm}.print-cover-badges b{padding:2mm 3.2mm;border-radius:99mm;color:#fff!important;background:rgba(255,255,255,.12);font-size:7.5pt}
  .print-impact-banner{display:grid;gap:1mm;margin:0 0 5mm;padding:5mm 6mm;border-radius:4mm;color:#fff!important;background:linear-gradient(120deg,#0b395d,#0e7e82 70%,#15967e)!important}.print-impact-banner span{color:#ffe09b!important;font-size:8pt}.print-impact-banner strong{color:#fff!important;font-size:13pt}.print-impact-banner small{color:#d9eff0!important;font-size:8pt}
  .print-category-bars{display:grid;gap:2mm;margin-top:5mm;padding:4.5mm;border:1px solid #dce8eb;border-radius:4mm;background:#f8fbfb}.print-category-bars>div{display:grid;grid-template-columns:38mm 1fr 8mm;align-items:center;gap:3mm}.print-category-bars span{color:#34596c!important;font-size:8pt;font-weight:900}.print-category-bars i{height:2.5mm;overflow:hidden;border-radius:99mm;background:#dce9eb}.print-category-bars i b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#147084,#19a382)!important}.print-category-bars strong{color:#0d6472!important;text-align:center}
  .portfolio-print-achievement>header{grid-template-columns:18mm 1fr 22mm!important}.print-achievement-stamp{display:grid!important;place-items:center!important;align-content:center!important;width:21mm;height:21mm;border:.6mm solid #c9952e;border-radius:50%;transform:rotate(-7deg);background:#fff9e9!important}.print-achievement-stamp span{margin:0!important;color:#9b6c16!important;font-size:7pt!important}.print-achievement-stamp strong{color:#8e6012!important;font-size:11pt}
  .print-achievement-tags{display:flex;flex-wrap:wrap;gap:1.5mm;margin:0 0 4mm}.print-achievement-tags span{padding:1.6mm 2.5mm;border-radius:99mm;color:#146b76!important;background:#e9f5f3!important;font-size:7pt;font-weight:900}
}
'''

page_path.write_text(page, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')

old_cache = 'ostadh-lahooni-v49-portfolio-print-command'
new_cache = 'ostadh-lahooni-v50-portfolio-achievement-preview'
if old_cache not in sw:
    raise SystemExit('service worker cache anchor missing')
sw_path.write_text(sw.replace(old_cache, new_cache, 1), encoding='utf-8')

print('portfolio preview v50 patched')
