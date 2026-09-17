from pathlib import Path

path = Path('app/student/page.tsx')
text = path.read_text(encoding='utf-8')
old = '  // بيانات الطالب تُحمّل عند الدخول فقط؛ لا إعادة قراءة تلقائية عند focus أو الرجوع للتطبيق.\n'
new = '''  // حدّث بيانات الطالب والحضور عند الرجوع للتطبيق/المتصفح بدون polling أو listener دائم.\n  useEffect(()=>{\n    if(!matches.length)return;\n    let refreshing=false;\n    const refresh=async()=>{\n      if(refreshing)return;\n      refreshing=true;\n      try{await hydrateAll(matches);}finally{refreshing=false;}\n    };\n    const onVisible=()=>{if(document.visibilityState===\"visible\")void refresh();};\n    const onPageShow=()=>{void refresh();};\n    window.addEventListener(\"focus\",refresh);\n    window.addEventListener(\"online\",refresh);\n    window.addEventListener(\"pageshow\",onPageShow);\n    document.addEventListener(\"visibilitychange\",onVisible);\n    return()=>{\n      window.removeEventListener(\"focus\",refresh);\n      window.removeEventListener(\"online\",refresh);\n      window.removeEventListener(\"pageshow\",onPageShow);\n      document.removeEventListener(\"visibilitychange\",onVisible);\n    };\n  },[matches]);\n'''
if old not in text:
    raise SystemExit('Expected student one-shot refresh marker not found; aborting safely.')
if 'window.addEventListener("pageshow",onPageShow)' in text:
    raise SystemExit('Patch already applied; aborting safely.')
path.write_text(text.replace(old,new,1), encoding='utf-8')
print('Patched student app lifecycle refresh safely.')
