package com.hassoun.health;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;

public class MainActivity extends Activity {
    WebView web;
    SharedPreferences prefs;
    TextToSpeech tts;
    boolean ttsReady = false;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(7,37,28));
        getWindow().setNavigationBarColor(Color.rgb(4,21,17));
        prefs = getSharedPreferences("health_native_notify", MODE_PRIVATE);

        requestNotificationPermissionIfNeeded();
        requestExactAlarmIfNeeded();
        initTts();

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(7,37,28));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index-v5.html");

        scheduleDefaults();
        restoreSmartNotifications();
    }

    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(new Locale("ar", "SA"));
                tts.setSpeechRate(0.94f);
                tts.setPitch(1.02f);
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
        }
    }

    private void requestExactAlarmIfNeeded() {
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager)getSystemService(ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms() && !prefs.getBoolean("asked_exact_v2", false)) {
                prefs.edit().putBoolean("asked_exact_v2", true).apply();
                try {
                    Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                } catch (Exception ignored) {}
            }
        }
    }

    public class Bridge {
        @JavascriptInterface public void speakWelcome() {
            runOnUiThread(() -> {
                if (ttsReady && tts != null) {
                    tts.speak("يا هلا حسن. جاهز ليوم صحي أقوى؟ خلنا نضبط أكلك، مويتك، وتمرينك.", TextToSpeech.QUEUE_FLUSH, null, "welcome");
                }
            });
        }

        @JavascriptInterface public void speak(String text) {
            if (text == null || text.trim().isEmpty()) return;
            runOnUiThread(() -> {
                if (ttsReady && tts != null) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "health_speech");
            });
        }

        @JavascriptInterface public String permissionsStatus() {
            try {
                boolean notifications = Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                boolean exact = true;
                if (Build.VERSION.SDK_INT >= 31) {
                    AlarmManager am = (AlarmManager)getSystemService(ALARM_SERVICE);
                    exact = am != null && am.canScheduleExactAlarms();
                }
                PowerManager pm = (PowerManager)getSystemService(POWER_SERVICE);
                boolean battery = pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
                JSONObject o = new JSONObject();
                o.put("notifications", notifications);
                o.put("exact", exact);
                o.put("battery", battery);
                return o.toString();
            } catch (Exception e) {
                return "{\"notifications\":false,\"exact\":false,\"battery\":false}";
            }
        }

        @JavascriptInterface public void enableNotifications() {
            runOnUiThread(() -> requestNotificationPermissionIfNeeded());
        }

        @JavascriptInterface public void openExactAlarmSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()))); }
                catch (Exception e) { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
            });
        }

        @JavascriptInterface public void openBatterySettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
                catch (Exception e) { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
            });
        }

        @JavascriptInterface public void testNotification() {
            NotificationScheduler.scheduleAfter(MainActivity.this, 10000, "اختبار صحة حسون ✅", "إذا وصلتك هذي الرسالة فالتنبيهات شغالة حتى بعد ما تقفل التطبيق.", 9901);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "اقفل التطبيق الآن؛ الاختبار بعد 10 ثوانٍ", Toast.LENGTH_LONG).show());
        }

        @JavascriptInterface public void scheduleNotifications(String morning, String water, String prep) {
            prefs.edit().putString("morning", morning).putString("water", water).putString("prep", prep).apply();
            NotificationScheduler.scheduleDaily(MainActivity.this, morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
            NotificationScheduler.scheduleDaily(MainActivity.this, water, "موية يا حسن 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
            NotificationScheduler.scheduleDaily(MainActivity.this, prep, "جهّز بكرة 🛒", "حان وقت تجهيز خطة وأكل بكرة.", 703);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم تفعيل التنبيهات العامة ✅", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface public void scheduleSmart(String json) {
            try {
                JSONObject o = new JSONObject(json);
                prefs.edit().putString("smart_times", json).apply();
                scheduleSmartObject(o);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم تفعيل التنبيهات الذكية للوجبات والرياضة ✅", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تعذر حفظ التنبيهات الذكية", Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface public void syncTodayState(String json) {
            try {
                JSONObject o = new JSONObject(json);
                SharedPreferences.Editor ed = prefs.edit();
                ed.putString("state_date", o.optString("date", ""));
                ed.putBoolean("done_breakfast", o.optBoolean("breakfast", false));
                ed.putBoolean("done_lunch", o.optBoolean("lunch", false));
                ed.putBoolean("done_snack", o.optBoolean("snack", false));
                ed.putBoolean("done_dinner", o.optBoolean("dinner", false));
                ed.putBoolean("done_workout", o.optBoolean("workout", false));
                ed.putBoolean("done_water", o.optBoolean("water", false));
                ed.apply();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface public void schedulePlan(String date, String json) {
            try {
                JSONArray arr = new JSONArray(json);
                prefs.edit().putString("plan_" + date, json).apply();
                int base = 20000 + Math.abs(date.hashCode() % 5000) * 10;
                for (int i = 0; i < 8; i++) NotificationScheduler.cancel(MainActivity.this, base + i);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    String time = o.optString("time", "");
                    String title = o.optString("title", "موعد خطتك");
                    String body = o.optString("body", "حان وقت المهمة المحفوظة في خطة صحة حسون.");
                    if (!time.isEmpty()) NotificationScheduler.scheduleOneShot(MainActivity.this, date, time, title, body, base + i);
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم ضبط تنبيهات الخطة ✅", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تعذر ضبط تنبيهات الخطة", Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface public void haptic(){
            try {
                Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);
                if(Build.VERSION.SDK_INT>=26) v.vibrate(VibrationEffect.createOneShot(24,95)); else v.vibrate(24);
            } catch(Exception ignored){}
        }
    }

    private void scheduleSmartObject(JSONObject o) {
        NotificationScheduler.scheduleDailyConditional(this, o.optString("breakfast", "08:15"), "فطورك يا حسن 🍳", "إذا ما سجلت فطورك للحين، اختر وجبة صحية وابدأ يومك مضبوط.", 811, "breakfast");
        NotificationScheduler.scheduleDailyConditional(this, o.optString("lunch", "13:30"), "موعد الغداء 🥗", "سجّل غداءك الصحي وخلك معتدل في الرز وأكثر من الخضار.", 812, "lunch");
        NotificationScheduler.scheduleDailyConditional(this, o.optString("water", "16:00"), "باقي مويتك 💧", "إذا ما وصلت لهدف الماء، كمل أكوابك من الحين.", 813, "water");
        NotificationScheduler.scheduleDailyConditional(this, o.optString("workout", "19:00"), "وقت الحركة 🏃", "ما سجلت تمرينك اليوم؟ اختر مشي أو كرة أو تمرين خفيف وابدأ.", 814, "workout");
        NotificationScheduler.scheduleDailyConditional(this, o.optString("dinner", "20:30"), "عشاك الصحي 🌙", "إذا ما سجلت العشاء، خله خفيف وبروتينه واضح.", 815, "dinner");
    }

    private void restoreSmartNotifications() {
        try {
            String saved = prefs.getString("smart_times", "");
            if (saved == null || saved.isEmpty()) {
                JSONObject d = new JSONObject();
                d.put("breakfast", "08:15"); d.put("lunch", "13:30"); d.put("water", "16:00"); d.put("workout", "19:00"); d.put("dinner", "20:30");
                saved = d.toString();
                prefs.edit().putString("smart_times", saved).apply();
            }
            scheduleSmartObject(new JSONObject(saved));
        } catch (Exception ignored) {}
    }

    private void scheduleDefaults(){
        String morning = prefs.getString("morning", "08:00");
        String water = prefs.getString("water", "13:30");
        String prep = prefs.getString("prep", "20:30");
        NotificationScheduler.scheduleDaily(this, morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
        NotificationScheduler.scheduleDaily(this, water, "موية يا حسن 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
        NotificationScheduler.scheduleDaily(this, prep, "جهّز بكرة 🛒", "حان وقت تجهيز خطة وأكل بكرة.", 703);
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.postDelayed(() -> web.evaluateJavascript("window.refreshPermissionStatus&&window.refreshPermissionStatus()", null), 350);
    }

    @Override protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }
}
