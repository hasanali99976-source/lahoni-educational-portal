package com.hassoun.health;

import android.content.*;
import org.json.*;
import java.util.*;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        SharedPreferences p = context.getSharedPreferences("health_native_notify", Context.MODE_PRIVATE);
        String morning = p.getString("morning", "08:00");
        String water = p.getString("water", "13:30");
        String prep = p.getString("prep", "20:30");
        NotificationScheduler.scheduleDaily(context, morning, "صباح صحة حسون 🌤️", "ابدأ يومك بماء وفطور بسيط وخلك ثابت.", 701);
        NotificationScheduler.scheduleDaily(context, water, "موية يا حسن 💧", "شيك على هدف الماء وكمل أكوابك اليوم.", 702);
        NotificationScheduler.scheduleDaily(context, prep, "جهّز بكرة 🛒", "حان وقت تجهيز خطة وأكل بكرة.", 703);

        try {
            String smart = p.getString("smart_times", "");
            if (smart != null && !smart.isEmpty()) {
                JSONObject o = new JSONObject(smart);
                NotificationScheduler.scheduleDailyConditional(context, o.optString("breakfast", "08:15"), "فطورك يا حسن 🍳", "إذا ما سجلت فطورك للحين، اختر وجبة صحية وابدأ يومك مضبوط.", 811, "breakfast");
                NotificationScheduler.scheduleDailyConditional(context, o.optString("lunch", "13:30"), "موعد الغداء 🥗", "سجّل غداءك الصحي وخلك معتدل في الرز وأكثر من الخضار.", 812, "lunch");
                NotificationScheduler.scheduleDailyConditional(context, o.optString("water", "16:00"), "باقي مويتك 💧", "إذا ما وصلت لهدف الماء، كمل أكوابك من الحين.", 813, "water");
                NotificationScheduler.scheduleDailyConditional(context, o.optString("workout", "19:00"), "وقت الحركة 🏃", "ما سجلت تمرينك اليوم؟ اختر مشي أو كرة أو تمرين خفيف وابدأ.", 814, "workout");
                NotificationScheduler.scheduleDailyConditional(context, o.optString("dinner", "20:30"), "عشاك الصحي 🌙", "إذا ما سجلت العشاء، خله خفيف وبروتينه واضح.", 815, "dinner");
            }
        } catch (Exception ignored) {}

        Map<String, ?> all = p.getAll();
        for (Map.Entry<String, ?> e : all.entrySet()) {
            if (!e.getKey().startsWith("plan_")) continue;
            String date = e.getKey().substring(5);
            try {
                JSONArray arr = new JSONArray(String.valueOf(e.getValue()));
                int base = 20000 + Math.abs(date.hashCode() % 5000) * 10;
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    NotificationScheduler.scheduleOneShot(context, date, o.optString("time"), o.optString("title", "موعد خطتك"), o.optString("body", "حان وقت مهمتك الصحية."), base + i);
                }
            } catch (Exception ignored) {}
        }
    }
}
