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
        getWindow().setStatusBarColor(Color.rgb(5, 30, 22));
        getWindow().setNavigationBarColor(Color.rgb(4, 22, 17));
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(5, 24, 18));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(buildVisualScript(), null);
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index-v3.html");
        scheduleDefaults();
    }

    private String buildVisualScript(){
        return "(function(){if(document.getElementById('native-health-skin'))return;"+
        "var st=document.createElement('style');st.id='native-health-skin';st.textContent=`"+
        "html,body{min-height:100%;background:linear-gradient(180deg,#031912 0%,#06291d 45%,#041a14 100%)!important;}"+
        ".app{max-width:none!important;width:100%!important;position:relative;z-index:2;}"+
        ".page{min-height:calc(100vh - 150px);position:relative;}"+
        ".top{background:linear-gradient(180deg,rgba(3,25,18,.98),rgba(5,38,27,.90))!important;box-shadow:0 8px 28px rgba(0,0,0,.28)!important;}"+
        ".hero,.card,.quick button,.welcomeBox{backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}"+
        ".card{background:linear-gradient(145deg,rgba(14,67,48,.91),rgba(5,38,27,.92))!important;border-color:rgba(126,239,186,.12)!important;}"+
        ".quick button{background:linear-gradient(145deg,rgba(19,86,61,.96),rgba(7,48,34,.96))!important;}"+
        ".nav{background:linear-gradient(180deg,rgba(4,24,18,.92),rgba(2,17,13,.98))!important;}"+
        ".health-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;opacity:.22;}"+
        ".health-bg span{position:absolute;font-size:30px;filter:drop-shadow(0 0 14px rgba(98,227,170,.4));animation:drift 12s ease-in-out infinite alternate;}"+
        ".health-bg span:nth-child(1){top:10%;right:5%;animation-delay:-2s}.health-bg span:nth-child(2){top:24%;left:6%;animation-delay:-5s}.health-bg span:nth-child(3){top:44%;right:8%;animation-delay:-7s}.health-bg span:nth-child(4){top:60%;left:8%;animation-delay:-3s}.health-bg span:nth-child(5){top:75%;right:12%;animation-delay:-9s}.health-bg span:nth-child(6){top:86%;left:14%;animation-delay:-1s}.health-bg span:nth-child(7){top:34%;left:45%;animation-delay:-6s}.health-bg span:nth-child(8){top:69%;right:42%;animation-delay:-4s}"+
        "@keyframes drift{0%{transform:translateY(-12px) rotate(-5deg) scale(.94)}100%{transform:translateY(28px) rotate(7deg) scale(1.10)}}"+
        ".health-scene{margin:12px 14px 0;padding:16px;border-radius:28px;background:linear-gradient(135deg,rgba(24,111,77,.96),rgba(7,53,38,.96));border:1px solid rgba(240,203,101,.25);box-shadow:0 18px 45px rgba(0,0,0,.35),0 0 30px rgba(98,227,170,.12);position:relative;overflow:hidden;}"+
        ".health-scene:before{content:'';position:absolute;inset:-50%;background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.13) 50%,transparent 58%);animation:sweep 5s linear infinite;}"+
        "@keyframes sweep{from{transform:translateX(-35%) rotate(8deg)}to{transform:translateX(35%) rotate(8deg)}}"+
        ".scene-title{font-weight:900;font-size:18px;position:relative;z-index:1}.scene-sub{font-size:11px;color:#cce4d9;margin-top:4px;position:relative;z-index:1}.scene-icons{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:13px;position:relative;z-index:1}.scene-icons div{height:58px;border-radius:18px;background:rgba(255,255,255,.08);display:grid;place-items:center;font-size:28px;border:1px solid rgba(255,255,255,.08);animation:breathe 2.8s ease-in-out infinite}.scene-icons div:nth-child(2){animation-delay:.3s}.scene-icons div:nth-child(3){animation-delay:.6s}.scene-icons div:nth-child(4){animation-delay:.9s}.scene-icons div:nth-child(5){animation-delay:1.2s}@keyframes breathe{50%{transform:translateY(-5px) scale(1.06);box-shadow:0 8px 20px rgba(0,0,0,.2)}}"+
        ".scene-chip{display:inline-flex;margin-top:11px;padding:7px 10px;border-radius:999px;background:rgba(240,203,101,.13);border:1px solid rgba(240,203,101,.30);color:#f7df94;font-size:10px;position:relative;z-index:1}`;document.head.appendChild(st);"+
        "var bg=document.createElement('div');bg.className='health-bg';bg.innerHTML='<span>🏃</span><span>🥗</span><span>💧</span><span>⚽</span><span>🍎</span><span>🏋️</span><span>🥦</span><span>❤️</span>';document.body.prepend(bg);"+
        "var app=document.querySelector('.app');if(app){var top=app.querySelector('.top');if(top){var sc=document.createElement('div');sc.className='health-scene';sc.innerHTML='<div class=\"scene-title\">حسون اليوم أقوى 💪</div><div class=\"scene-sub\">حركة + أكل نظيف + ماء = يوم محسوب صح</div><div class=\"scene-icons\"><div>🏃</div><div>🥗</div><div>💧</div><div>⚽</div><div>🍎</div></div><div class=\"scene-chip\">هوية صحة حسون • نسخة أفضل من نفسك</div>';top.insertAdjacentElement('afterend',sc);}}"+
        "})();";
    }

    public class Bridge {
        @JavascriptInterface public void scheduleNotifications(String morning, String water, String prep) {
            scheduleRepeating(morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
            scheduleRepeating(water, "موية يا حسن 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
            scheduleRepeating(prep, "جهّز بكرة 🛒", "حان وقت تجهيز خطة وأكل بكرة.", 703);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم تفعيل التنبيهات بصوت صحة حسون ✅", Toast.LENGTH_SHORT).show());
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
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم ضبط تنبيهات الخطة بصوت مميز ✅", Toast.LENGTH_SHORT).show());
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
