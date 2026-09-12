package com.hassoun.health;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.*;
import android.webkit.*;
import android.widget.Toast;
import java.util.Calendar;

public class MainActivity extends Activity {
    WebView web;
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(7,27,21));
        getWindow().setNavigationBarColor(Color.rgb(6,23,18));
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(7,27,21));
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
            schedule(morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
            schedule(water, "موية يا حسون 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
            schedule(prep, "جهّز بكرة 🛒", "حان وقت تجهيز أكل بكرة من الموجود عندك.", 703);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم تفعيل التنبيهات اليومية ✅", Toast.LENGTH_SHORT).show());
        }
        @JavascriptInterface public void haptic(){
            try {
                android.os.Vibrator v=(android.os.Vibrator)getSystemService(VIBRATOR_SERVICE);
                if(Build.VERSION.SDK_INT>=26) v.vibrate(android.os.VibrationEffect.createOneShot(18,80)); else v.vibrate(18);
            } catch(Exception ignored){}
        }
    }

    private void scheduleDefaults(){
        schedule("08:00","صباح صحة حسون 🌤️","ابدأ يومك بماء وفطور بسيط وخلك ثابت.",701);
        schedule("13:30","موية يا حسون 💧","شيك على هدف الماء وكمل أكوابك اليوم.",702);
        schedule("20:30","جهّز بكرة 🛒","حان وقت تجهيز أكل بكرة من الموجود عندك.",703);
    }
    private void schedule(String hhmm, String title, String body, int req){
        try {
            String[] p=hhmm.split(":"); int h=Integer.parseInt(p[0]), m=Integer.parseInt(p[1]);
            Calendar c=Calendar.getInstance(); c.set(Calendar.HOUR_OF_DAY,h); c.set(Calendar.MINUTE,m); c.set(Calendar.SECOND,0); c.set(Calendar.MILLISECOND,0);
            if(c.getTimeInMillis()<=System.currentTimeMillis()) c.add(Calendar.DAY_OF_YEAR,1);
            Intent i=new Intent(this, NotificationReceiver.class); i.putExtra("title",title); i.putExtra("body",body);
            PendingIntent pi=PendingIntent.getBroadcast(this, req, i, PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
            AlarmManager am=(AlarmManager)getSystemService(ALARM_SERVICE);
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP,c.getTimeInMillis(),AlarmManager.INTERVAL_DAY,pi);
        } catch(Exception ignored){}
    }
}
