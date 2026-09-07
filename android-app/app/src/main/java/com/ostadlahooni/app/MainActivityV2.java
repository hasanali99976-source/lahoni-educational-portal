package com.ostadlahooni.app;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.lang.reflect.Field;
import java.util.Locale;

public class MainActivityV2 extends MainActivity {
    private TextToSpeech textToSpeech;
    private volatile boolean ttsReady = false;
    private WebView bridgedWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        initializeNativeSpeech();
        attachSpeechBridge();
    }

    private void initializeNativeSpeech() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS || textToSpeech == null) return;
            Locale saudiArabic = new Locale("ar", "SA");
            int result = textToSpeech.setLanguage(saudiArabic);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                result = textToSpeech.setLanguage(new Locale("ar"));
            }
            textToSpeech.setSpeechRate(0.94f);
            textToSpeech.setPitch(1.0f);
            ttsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED;
        });
    }

    private void attachSpeechBridge() {
        try {
            Field field = MainActivity.class.getDeclaredField("webView");
            field.setAccessible(true);
            Object value = field.get(this);
            if (!(value instanceof WebView)) return;
            bridgedWebView = (WebView) value;
            bridgedWebView.addJavascriptInterface(new SpeechBridge(), "OstadhTts");
        } catch (Exception ignored) {
        }
    }

    private void speakArabicNow(String text) {
        final String safeText = text == null ? "" : text.trim();
        if (safeText.isEmpty()) return;
        runOnUiThread(() -> {
            if (textToSpeech == null) return;
            if (!ttsReady) {
                textToSpeech.setLanguage(new Locale("ar", "SA"));
                ttsReady = true;
            }
            textToSpeech.stop();
            textToSpeech.speak(safeText, TextToSpeech.QUEUE_FLUSH, null, "ostadh-login-greeting");
        });
    }

    private class SpeechBridge {
        @JavascriptInterface
        public void speakArabic(String text) {
            speakArabicNow(text);
        }

        @JavascriptInterface
        public void stopSpeech() {
            runOnUiThread(() -> {
                if (textToSpeech != null) textToSpeech.stop();
            });
        }

        @JavascriptInterface
        public boolean isReady() {
            return ttsReady;
        }
    }

    @Override
    protected void onDestroy() {
        if (bridgedWebView != null) {
            try { bridgedWebView.removeJavascriptInterface("OstadhTts"); } catch (Exception ignored) {}
            bridgedWebView = null;
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.onDestroy();
    }
}
