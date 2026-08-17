package com.ostadlahooni.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://tahdheeb-history.vercel.app/";
    private static final String APP_VERSION = "1.5.0";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private ToneGenerator introTone;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);
        playIntroSound();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUserAgentString(settings.getUserAgentString() + " OstadhLahooniAndroid/" + APP_VERSION);

        webView.clearCache(true);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(true);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webView.addJavascriptInterface(new NativeBridge(), "OstadhApp");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("ostadh".equals(uri.getScheme()) && "print".equals(uri.getHost())) {
                    printCurrentPage("أستاذ لحوني");
                    return true;
                }
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if (("http".equals(scheme) || "https".equals(scheme)) && host != null && (host.equals("tahdheeb-history.vercel.app") || host.endsWith(".vercel.app"))) return false;
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                String bridgeScript = "(function(){" +
                    "window.__OSTADH_ANDROID__=true;" +
                    "var cacheKey='ostadh-clean-1.5.0';" +
                    "if(!sessionStorage.getItem(cacheKey)){sessionStorage.setItem(cacheKey,'1');var jobs=[];" +
                    "if('serviceWorker' in navigator){jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));}));}" +
                    "if(window.caches){jobs.push(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}));}" +
                    "Promise.all(jobs).then(function(){if(jobs.length){location.replace(location.pathname+location.search+(location.search?'&':'?')+'fresh='+Date.now());}});}" +
                    "window.ostadhNativePrint=function(title){try{OstadhApp.printPage(title||document.title||'أستاذ لحوني');return true;}catch(e){return false;}};" +
                    "window.ostadhNativeShare=function(title,text,url){try{OstadhApp.shareText(title||document.title||'',text||'',url||location.href);return true;}catch(e){return false;}};" +
                    "window.ostadhNativeCopy=function(text){try{OstadhApp.copyText(text||location.href);return true;}catch(e){return false;}};" +
                    "window.print=function(){window.ostadhNativePrint(document.title||'أستاذ لحوني');};" +
                    "navigator.share=function(data){window.ostadhNativeShare((data&&data.title)||'',(data&&data.text)||'',(data&&data.url)||location.href);return Promise.resolve();};" +
                    "if(navigator.clipboard){var oldWrite=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=function(text){try{window.ostadhNativeCopy(text);return Promise.resolve();}catch(e){return oldWrite(text);}};}" +
                    "document.addEventListener('click',function(e){var button=e.target.closest('button,a');if(!button)return;var text=(button.innerText||button.textContent||'').trim();var h=button.href||'';" +
                    "if(button.classList.contains('print-sheet-button')||button.dataset.nativePrint==='true'||text.indexOf('طباعة')>-1){e.preventDefault();e.stopImmediatePropagation();window.ostadhNativePrint(document.title||'كشف أستاذ لحوني');return;}" +
                    "if(button.dataset.nativeShare==='true'||text.indexOf('مشاركة')>-1||text.indexOf('إرسال')>-1){if(!h||h.indexOf('wa.me/')<0){e.preventDefault();window.ostadhNativeShare(document.title,text,location.href);return;}}" +
                    "if(button.dataset.copyLink==='true'||text.indexOf('نسخ الرابط')>-1){e.preventDefault();window.ostadhNativeCopy(h||location.href);return;}" +
                    "if(h.indexOf('wa.me/')>-1||h.indexOf('whatsapp:')===0||h.indexOf('mailto:')===0||h.indexOf('tel:')===0||h.indexOf('sms:')===0){e.preventDefault();OstadhApp.openUrl(h);return;}" +
                    "if(button.hasAttribute('download')&&h){e.preventDefault();OstadhApp.openUrl(h);return;}" +
                    "},true);})();";
                view.evaluateJavascript(bridgeScript, null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST); return true; }
                catch (Exception error) { fileCallback = null; Toast.makeText(MainActivity.this, "تعذر فتح الملفات", Toast.LENGTH_SHORT).show(); return false; }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                request.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                String extension = mimeType != null && mimeType.contains("pdf") ? ".pdf" : "";
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "ostadh-lahooni-" + System.currentTimeMillis() + extension);
                ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(request);
                Toast.makeText(this, "تم بدء الحفظ في التنزيلات", Toast.LENGTH_SHORT).show();
            } catch (Exception error) { openExternal(Uri.parse(url)); }
        });

        if (savedInstanceState == null) webView.loadUrl(HOME_URL + "?appVersion=" + APP_VERSION + "&fresh=" + System.currentTimeMillis());
        else webView.restoreState(savedInstanceState);
    }

    private void playIntroSound() {
        try {
            introTone = new ToneGenerator(AudioManager.STREAM_MUSIC, 45);
            Handler handler = new Handler(Looper.getMainLooper());
            handler.postDelayed(() -> introTone.startTone(ToneGenerator.TONE_DTMF_1, 130), 80);
            handler.postDelayed(() -> introTone.startTone(ToneGenerator.TONE_DTMF_5, 130), 240);
            handler.postDelayed(() -> introTone.startTone(ToneGenerator.TONE_DTMF_9, 190), 400);
            handler.postDelayed(() -> { if (introTone != null) { introTone.release(); introTone = null; } }, 800);
        } catch (Exception ignored) {}
    }

    private void openExternal(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (Exception error) { Toast.makeText(this, "لا يوجد تطبيق مناسب لتنفيذ الأمر", Toast.LENGTH_SHORT).show(); }
    }

    private void printCurrentPage(String title) {
        runOnUiThread(() -> {
            try {
                if (webView == null) return;
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) { Toast.makeText(this, "خدمة الطباعة غير متاحة على هذا الجهاز", Toast.LENGTH_LONG).show(); return; }
                String jobTitle = title == null || title.trim().isEmpty() ? "أستاذ لحوني" : title.trim();
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobTitle);
                PrintAttributes attributes = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).setColorMode(PrintAttributes.COLOR_MODE_COLOR).setResolution(new PrintAttributes.Resolution("ostadh", "أستاذ لحوني", 300, 300)).setMinMargins(PrintAttributes.Margins.NO_MARGINS).build();
                printManager.print(jobTitle, adapter, attributes);
            } catch (Exception error) { Toast.makeText(this, "تعذر فتح الطباعة: " + error.getClass().getSimpleName(), Toast.LENGTH_LONG).show(); }
        });
    }

    private class NativeBridge {
        @JavascriptInterface public void printPage(String title) { printCurrentPage(title); }
        @JavascriptInterface public void openUrl(String url) { runOnUiThread(() -> openExternal(Uri.parse(url))); }
        @JavascriptInterface public void shareText(String title, String text, String url) {
            runOnUiThread(() -> { Intent share = new Intent(Intent.ACTION_SEND); share.setType("text/plain"); String body = (text == null ? "" : text) + ((url == null || url.isEmpty()) ? "" : "\n" + url); share.putExtra(Intent.EXTRA_SUBJECT, title == null ? "أستاذ لحوني" : title); share.putExtra(Intent.EXTRA_TEXT, body); startActivity(Intent.createChooser(share, "مشاركة عبر")); });
        }
        @JavascriptInterface public void copyText(String text) {
            runOnUiThread(() -> { ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); if (clipboard != null) { clipboard.setPrimaryClip(ClipData.newPlainText("أستاذ لحوني", text == null ? "" : text)); Toast.makeText(MainActivity.this, "تم النسخ", Toast.LENGTH_SHORT).show(); } });
        }
        @JavascriptInterface public void saved(String message) { runOnUiThread(() -> Toast.makeText(MainActivity.this, message == null || message.isEmpty() ? "تم الحفظ" : message, Toast.LENGTH_SHORT).show()); }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) { Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data); if (fileCallback != null) fileCallback.onReceiveValue(result); fileCallback = null; return; }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override protected void onSaveInstanceState(Bundle outState) { webView.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onDestroy() { if (introTone != null) { introTone.release(); introTone = null; } if (webView != null) { webView.removeJavascriptInterface("OstadhApp"); webView.destroy(); } super.onDestroy(); }
    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
