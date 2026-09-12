package com.hassoun.health;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.*;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class MainActivity extends Activity {
    WebView web;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(6,25,19));
        getWindow().setNavigationBarColor(Color.rgb(5,22,17));
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
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
        web.loadUrl("file:///android_asset/index.html");
        scheduleDefaults();
    }

    public class Bridge {
        @JavascriptInterface public void scheduleNotifications(String morning, String water, String prep) {
            scheduleRepeating(morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
            scheduleRepeating(water, "موية يا حسن 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
            scheduleRepeating(prep, "جهّز بكرة 🛒", "حان وقت تجهيز خطة وأكل بكرة.", 703);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم تفعيل التنبيهات اليومية ✅", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface public void schedulePlan(String date, String json) {
            try {
                JSONArray arr = new JSONArray(json);
                int base = 20000 + Math.abs(date.hashCode() % 5000) * 10;
                AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
                for (int i = 0; i < 8; i++) {
                    Intent oldIntent = new Intent(MainActivity.this, NotificationReceiver.class);
                    PendingIntent oldPi = PendingIntent.getBroadcast(MainActivity.this, base + i, oldIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_NO_CREATE);
                    if (oldPi != null) am.cancel(oldPi);
                }
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    String time = o.optString("time", "");
                    String title = o.optString("title", "موعد خطتك");
                    String body = o.optString("body", "حان وقت المهمة المحفوظة في خطة صحة حسون.");
                    if (!time.isEmpty()) scheduleOneShot(date, time, title, body, base + i);
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
        scheduleRepeating("08:00","صباح صحة حسون 🌤️","ابدأ يومك بماء وفطور بسيط وخلك ثابت.",701);
        scheduleRepeating("13:30","موية يا حسن 💧","شيك على هدف الماء وكمل أكوابك اليوم.",702);
        scheduleRepeating("20:30","جهّز بكرة 🛒","حان وقت تجهيز خطة وأكل بكرة.",703);
    }

    private void scheduleRepeating(String hhmm, String title, String body, int req){
        try {
            String[] p=hhmm.split(":");
            int h=Integer.parseInt(p[0]), m=Integer.parseInt(p[1]);
            Calendar c=Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY,h); c.set(Calendar.MINUTE,m); c.set(Calendar.SECOND,0); c.set(Calendar.MILLISECOND,0);
            if(c.getTimeInMillis()<=System.currentTimeMillis()) c.add(Calendar.DAY_OF_YEAR,1);
            Intent i=new Intent(this, NotificationReceiver.class);
            i.putExtra("title",title); i.putExtra("body",body);
            PendingIntent pi=PendingIntent.getBroadcast(this, req, i, PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
            AlarmManager am=(AlarmManager)getSystemService(ALARM_SERVICE);
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP,c.getTimeInMillis(),AlarmManager.INTERVAL_DAY,pi);
        } catch(Exception ignored){}
    }

    private void scheduleOneShot(String date, String hhmm, String title, String body, int req){
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US);
            long when = f.parse(date + " " + hhmm).getTime();
            if (when <= System.currentTimeMillis()) return;
            Intent i = new Intent(this, NotificationReceiver.class);
            i.putExtra("title", title);
            i.putExtra("body", body);
            PendingIntent pi = PendingIntent.getBroadcast(this, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            AlarmManager am = (AlarmManager)getSystemService(ALARM_SERVICE);
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            else am.set(AlarmManager.RTC_WAKEUP, when, pi);
        } catch (Exception ignored) {}
    }
}
