package com.hassoun.health;

import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

public class NotificationReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        if (title == null) title = "صحة حسون";
        if (body == null) body = "حان وقت خطتك الصحية.";

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "health_sound_v3";
        Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.health_chime);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(channelId, "تنبيهات صحة حسون الصوتية", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("تنبيهات الوجبات والماء والنشاط بصوت صحة حسون");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0,180,90,220});
            ch.setSound(soundUri, attrs);
            nm.createNotificationChannel(ch);
        }

        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, channelId) : new Notification.Builder(context);
        b.setSmallIcon(R.drawable.app_icon)
         .setContentTitle(title)
         .setContentText(body)
         .setStyle(new Notification.BigTextStyle().bigText(body))
         .setAutoCancel(true)
         .setContentIntent(pi)
         .setPriority(Notification.PRIORITY_HIGH)
         .setCategory(Notification.CATEGORY_REMINDER)
         .setVibrate(new long[]{0,180,90,220});
        if (Build.VERSION.SDK_INT < 26) b.setSound(soundUri);
        nm.notify((int)(System.currentTimeMillis()%100000), b.build());

        if (intent.getBooleanExtra("daily", false)) {
            String time = intent.getStringExtra("time");
            int req = intent.getIntExtra("req", 900);
            if (time != null) NotificationScheduler.scheduleDaily(context, time, title, body, req);
        }
    }
}
