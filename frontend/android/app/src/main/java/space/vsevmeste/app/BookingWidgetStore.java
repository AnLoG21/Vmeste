package space.vsevmeste.app;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Snapshot written by the Capacitor WebView shell for the home-screen booking widget.
 */
public final class BookingWidgetStore {
    public static final String PREFS = "vmeste_booking_widget";
    public static final String KEY_TODAY_LINE = "today_line";
    public static final String KEY_NEXT_LINE = "next_line";
    public static final String KEY_NEXT_TIME = "next_time";
    public static final String KEY_HAS_DATA = "has_data";
    public static final String KEY_UPDATED_AT = "updated_at";

    private BookingWidgetStore() {}

    public static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void write(Context context, String todayLine, String nextLine, String nextTime) {
        prefs(context)
            .edit()
            .putBoolean(KEY_HAS_DATA, true)
            .putString(KEY_TODAY_LINE, todayLine != null ? todayLine : "")
            .putString(KEY_NEXT_LINE, nextLine != null ? nextLine : "")
            .putString(KEY_NEXT_TIME, nextTime != null ? nextTime : "")
            .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
            .apply();
    }

    public static void clear(Context context) {
        prefs(context).edit().clear().apply();
    }
}
