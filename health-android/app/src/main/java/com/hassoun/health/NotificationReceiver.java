package com.hassoun.health;

import android.app.*;
import android.content.*;
import android.media.*;
import android.os.Build;

public class NotificationReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        final PendingResult pending = goAsync();
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        if (title == null) title = "صحة حسون";
        if (body == null) body = "حان وقت خطتك الصحية.";

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "health_daily_v2";
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(channelId, "تنبيهات صحة حسون المميزة", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("تذكيرات الماء والوجبات والنشاط بصوت صحة حسون");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0,120,80,150});
            ch.setSound(null, null);
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
         .setVibrate(new long[]{0,120,80,150});
        if (Build.VERSION.SDK_INT < 26) b.setSound(null);
        nm.notify((int)(System.currentTimeMillis()%100000), b.build());

        new Thread(() -> {
            try { playHealthChime(); } finally { pending.finish(); }
        }).start();
    }

    private void playHealthChime() {
        final int sampleRate = 22050;
        final double seconds = 2.15;
        final int total = (int)(sampleRate * seconds);
        short[] pcm = new short[total];
        for (int i = 0; i < total; i++) {
            double t = i / (double) sampleRate;
            double x = 0;
            x += pulse(t, 0.00, 0.16, 740, 0.33);
            x += pulse(t, 0.22, 0.18, 988, 0.34);
            x += pulse(t, 0.48, 0.22, 1175, 0.36);
            x += pulse(t, 0.84, 0.08, 1350, 0.16);
            x += pulse(t, 1.04, 0.34, 880, 0.18);
            x += pulse(t, 1.04, 0.34, 1320, 0.11);
            x += pulse(t, 1.46, 0.42, 1046, 0.20);
            x += pulse(t, 1.46, 0.42, 1568, 0.10);
            double fade = t > 1.75 ? Math.max(0, (2.15 - t) / 0.40) : 1.0;
            x *= fade;
            x = Math.max(-0.92, Math.min(0.92, x));
            pcm[i] = (short)(x * 32767);
        }
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        AudioFormat fmt = new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();
        AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(attrs)
                .setAudioFormat(fmt)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(pcm.length * 2)
                .build();
        track.write(pcm, 0, pcm.length);
        track.play();
        try { Thread.sleep(2350); } catch (InterruptedException ignored) {}
        track.stop();
        track.release();
    }

    private double pulse(double t, double start, double dur, double freq, double amp) {
        if (t < start || t > start + dur) return 0;
        double u = (t - start) / dur;
        double env = Math.sin(Math.PI * u);
        env *= env;
        return Math.sin(2 * Math.PI * freq * (t - start)) * env * amp;
    }
}
