package com.hassoun.health;

import android.app.*;
import android.content.*;
import android.os.Build;
import java.text.SimpleDateFormat;
import java.util.*;

public final class NotificationScheduler {
    private NotificationScheduler() {}

    public static void scheduleDaily(Context context, String hhmm, String title, String body, int req) {
        try {
            String[] p = hhmm.split(":");
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, Integer.parseInt(p[0]));
            c.set(Calendar.MINUTE, Integer.parseInt(p[1]));
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            if (c.getTimeInMillis() <= System.currentTimeMillis()) c.add(Calendar.DAY_OF_YEAR, 1);
            Intent i = new Intent(context, NotificationReceiver.class);
            i.putExtra("title", title);
            i.putExtra("body", body);
            i.putExtra("daily", true);
            i.putExtra("time", hhmm);
            i.putExtra("req", req);
            PendingIntent pi = PendingIntent.getBroadcast(context, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            schedule(context, c.getTimeInMillis(), pi);
        } catch (Exception ignored) {}
    }

    public static void scheduleOneShot(Context context, String date, String hhmm, String title, String body, int req) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US);
            Date parsed = f.parse(date + " " + hhmm);
            if (parsed == null || parsed.getTime() <= System.currentTimeMillis()) return;
            Intent i = new Intent(context, NotificationReceiver.class);
            i.putExtra("title", title);
            i.putExtra("body", body);
            PendingIntent pi = PendingIntent.getBroadcast(context, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            schedule(context, parsed.getTime(), pi);
        } catch (Exception ignored) {}
    }

    private static void schedule(Context context, long when, PendingIntent pi) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 31 && am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, when, pi);
            }
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            else am.set(AlarmManager.RTC_WAKEUP, when, pi);
        }
    }
}
