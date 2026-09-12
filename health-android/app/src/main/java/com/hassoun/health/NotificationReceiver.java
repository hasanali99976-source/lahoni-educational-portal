package com.hassoun.health;

import android.app.*;
import android.content.*;
import android.os.Build;

public class NotificationReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "health_daily";
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(channelId, "تنبيهات صحة حسون", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("تذكيرات الماء والوجبات والنشاط");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, channelId) : new Notification.Builder(context);
        b.setSmallIcon(R.drawable.app_icon).setContentTitle(title).setContentText(body).setAutoCancel(true).setContentIntent(pi);
        nm.notify((int)(System.currentTimeMillis()%100000), b.build());
    }
}
