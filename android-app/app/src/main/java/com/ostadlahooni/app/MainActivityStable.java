package com.ostadlahooni.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.lang.reflect.Field;

public class MainActivityStable extends MainActivity {
    private static final String STABLE_HOME = "https://tahdheeb-history.vercel.app/?appVersion=1.8.3";
    private WebView stableWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        attachStableClient();
    }

    private void attachStableClient() {
        try {
            Field field = MainActivity.class.getDeclaredField("webView");
            field.setAccessible(true);
            Object value = field.get(this);
            if (!(value instanceof WebView)) return;
            stableWebView = (WebView) value;

            WebSettings settings = stableWebView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);

            stableWebView.stopLoading();
            stableWebView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    String scheme = uri.getScheme();
                    String host = uri.getHost();
                    if (("http".equals(scheme) || "https".equals(scheme)) && host != null &&
                        (host.equals("tahdheeb-history.vercel.app") || host.endsWith(".vercel.app"))) {
                        return false;
                    }
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    view.evaluateJavascript("(function(){window.__OSTADH_ANDROID__=true;})();", null);
                }
            });

            stableWebView.loadUrl(STABLE_HOME);
        } catch (Exception ignored) {
        }
    }
}
