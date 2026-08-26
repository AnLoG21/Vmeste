package space.vsevmeste.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Capacitor shell: notification channel + deep-link handoff + WebView edge cases.
 */
public class MainActivity extends BridgeActivity {
    public static final String CHANNEL_ID = "vmeste_default";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        ensureNotificationChannel();
        super.onCreate(savedInstanceState);
        hardenWebView();
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Вместе",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Записи, заказы, чаты");
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
    }

    private void hardenWebView() {
        try {
            WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
            if (webView == null) return;
            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            }
            // Avoid blank WebView after process death / cold start with stale cache.
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
            webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
        } catch (Exception ignored) {
            /* bridge may not be ready yet */
        }
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;
        // Capacitor Bridge loads server.url; path is still useful for future JS deep-link hooks.
        try {
            if (getBridge() != null && data.getPath() != null) {
                getBridge().triggerJSEvent("vmesteDeepLink", "window", "\"" + data.toString().replace("\"", "\\\"") + "\"");
            }
        } catch (Exception ignored) {
            /* ignore */
        }
    }
}
