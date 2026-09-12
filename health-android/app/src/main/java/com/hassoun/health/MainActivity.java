package com.hassoun.health;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    WebView web;
    SharedPreferences prefs;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(6,25,19));
        getWindow().setNavigationBarColor(Color.rgb(4,20,15));
        prefs = getSharedPreferences("health_native_notify", MODE_PRIVATE);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
        }
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager)getSystemService(ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms() && !prefs.getBoolean("asked_exact", false)) {
                prefs.edit().putBoolean("asked_exact", true).apply();
                try {
                    Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                } catch (Exception ignored) {}
            }
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(6,25,19));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index-v4.html");
        scheduleDefaults();
    }

    public class Bridge {
        @JavascriptInterface public void scheduleNotifications(String morning, String water, String prep) {
            prefs.edit().putString("morning", morning).putString("water", water).putString("prep", prep).apply();
            NotificationScheduler.scheduleDaily(MainActivity.this, morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
            NotificationScheduler.scheduleDaily(MainActivity.this, water, "موية يا حسن 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
            NotificationScheduler.scheduleDaily(MainActivity.this, prep, "جهّز بكرة 🛒", "حان وقت تجهيز خطة وأكل بكرة.", 703);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم تفعيل التنبيهات الصوتية ✅", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface public void schedulePlan(String date, String json) {
            try {
                JSONArray arr = new JSONArray(json);
                prefs.edit().putString("plan_" + date, json).apply();
                int base = 20000 + Math.abs(date.hashCode() % 5000) * 10;
                AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
                for (int i = 0; i < 8; i++) {
                    Intent oldIntent = new Intent(MainActivity.this, NotificationReceiver.class);
                    PendingIntent oldPi = PendingIntent.getBroadcast(MainActivity.this, base + i, oldIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_NO_CREATE);
                    if (oldPi != null && am != null) am.cancel(oldPi);
                }
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
                if(Build.VERSION.SDK_INT>=26) v.vibrate(VibrationEffect.createOneShot(20,90)); else v.vibrate(20);
            } catch(Exception ignored){}
        }
    }

    private void scheduleDefaults(){
        String morning = prefs.getString("morning", "08:00");
        String water = prefs.getString("water", "13:30");
        String prep = prefs.getString("prep", "20:30");
        NotificationScheduler.scheduleDaily(this, morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
        NotificationScheduler.scheduleDaily(this, water, "موية يا حسن 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
        NotificationScheduler.scheduleDaily(this, prep, "جهّز بكرة 🛒", "حان وقت تجهيز خطة وأكل بكرة.", 703);
    }
}
