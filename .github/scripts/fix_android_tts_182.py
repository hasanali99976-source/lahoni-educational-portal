from pathlib import Path
import re

root = Path('.')
main = root / 'android-app/app/src/main/java/com/ostadlahooni/app/MainActivity.java'
gradle = root / 'android-app/app/build.gradle'

text = main.read_text(encoding='utf-8')
text = text.replace('private static final String APP_VERSION = "1.8.0";', 'private static final String APP_VERSION = "1.8.2";')
text = text.replace('webView.addJavascriptInterface(new NativeBridge(), "OstadhApp");', 'NativeBridge nativeBridge = new NativeBridge();\n        webView.addJavascriptInterface(nativeBridge, "OstadhApp");\n        webView.addJavascriptInterface(nativeBridge, "OstadhTts");')
text = text.replace("var cacheKey='ostadh-clean-1.8.0';", "var cacheKey='ostadh-clean-1.8.2';")

new_init = '''    private void initTextToSpeech() {
        try {
            ttsReady = false;
            tts = new TextToSpeech(getApplicationContext(), status -> {
                if (status != TextToSpeech.SUCCESS || tts == null) {
                    ttsReady = false;
                    return;
                }
                try {
                    int result = tts.setLanguage(new Locale("ar", "SA"));
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        result = tts.setLanguage(new Locale("ar"));
                    }
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.getDefault());
                    }
                    tts.setSpeechRate(0.94f);
                    tts.setPitch(1.0f);
                    ttsReady = true;
                    String queued = pendingSpeech;
                    pendingSpeech = null;
                    if (queued != null && !queued.trim().isEmpty()) speakArabicNative(queued);
                } catch (Exception error) {
                    ttsReady = false;
                }
            });
        } catch (Exception ignored) {
            ttsReady = false;
        }
    }
'''
text, count = re.subn(r'    private void initTextToSpeech\(\) \{.*?\n    \}\n\n    private void speakArabicNative', new_init + '\n    private void speakArabicNative', text, flags=re.S)
if count != 1:
    raise SystemExit(f'initTextToSpeech replacement count={count}')

new_speak = '''    private void speakArabicNative(String text) {
        final String safe = text == null ? "" : text.trim();
        if (safe.isEmpty()) return;
        runOnUiThread(() -> {
            try {
                if (tts == null || !ttsReady) {
                    pendingSpeech = safe;
                    if (tts == null) initTextToSpeech();
                    return;
                }
                int result = tts.speak(safe, TextToSpeech.QUEUE_FLUSH, null, "ostadh-greeting-" + System.currentTimeMillis());
                if (result == TextToSpeech.ERROR) {
                    pendingSpeech = safe;
                    ttsReady = false;
                    try { tts.shutdown(); } catch (Exception ignored) {}
                    tts = null;
                    initTextToSpeech();
                }
            } catch (Exception ignored) {
                pendingSpeech = safe;
            }
        });
    }
'''
text, count = re.subn(r'    private void speakArabicNative\(String text\) \{.*?\n    \}\n\n    private void stopArabicNative', new_speak + '\n    private void stopArabicNative', text, flags=re.S)
if count != 1:
    raise SystemExit(f'speakArabicNative replacement count={count}')

text = text.replace('if (webView != null) { webView.removeJavascriptInterface("OstadhApp"); webView.destroy(); }', 'if (webView != null) { webView.removeJavascriptInterface("OstadhApp"); webView.removeJavascriptInterface("OstadhTts"); webView.destroy(); }')
main.write_text(text, encoding='utf-8')

g = gradle.read_text(encoding='utf-8')
g = re.sub(r'versionCode\s+\d+', 'versionCode 14', g)
g = re.sub(r"versionName\s+'[^']+'", "versionName '1.8.2'", g)
gradle.write_text(g, encoding='utf-8')
print('Android native TTS v1.8.2 patched.')
