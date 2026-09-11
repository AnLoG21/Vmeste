package space.vsevmeste.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Home-screen widget: today's summary + nearest upcoming booking.
 * Data is pushed from JS via {@link BookingWidgetPlugin} (WebView JWT is not readable here).
 */
public class BookingWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateOne(context, appWidgetManager, appWidgetId);
        }
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, BookingWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        if (ids == null || ids.length == 0) return;
        for (int id : ids) {
            updateOne(context, manager, id);
        }
    }

    private static void updateOne(Context context, AppWidgetManager manager, int appWidgetId) {
        SharedPreferences prefs = BookingWidgetStore.prefs(context);
        boolean hasData = prefs.getBoolean(BookingWidgetStore.KEY_HAS_DATA, false);
        String todayLine = prefs.getString(BookingWidgetStore.KEY_TODAY_LINE, "");
        String nextLine = prefs.getString(BookingWidgetStore.KEY_NEXT_LINE, "");
        String nextTime = prefs.getString(BookingWidgetStore.KEY_NEXT_TIME, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_bookings);

        if (!hasData) {
            views.setTextViewText(R.id.widget_today, context.getString(R.string.widget_login_hint));
            views.setTextViewText(R.id.widget_next_label, context.getString(R.string.widget_next_label));
            views.setTextViewText(R.id.widget_next_value, context.getString(R.string.widget_open_app));
        } else {
            views.setTextViewText(
                R.id.widget_today,
                todayLine != null && !todayLine.trim().isEmpty()
                    ? todayLine
                    : context.getString(R.string.widget_today_empty)
            );
            views.setTextViewText(R.id.widget_next_label, context.getString(R.string.widget_next_label));
            if (nextLine == null || nextLine.trim().isEmpty()) {
                views.setTextViewText(R.id.widget_next_value, context.getString(R.string.widget_no_upcoming));
            } else if (nextTime != null && !nextTime.trim().isEmpty()) {
                views.setTextViewText(R.id.widget_next_value, nextTime + " · " + nextLine);
            } else {
                views.setTextViewText(R.id.widget_next_value, nextLine);
            }
        }

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("vmeste://app/bookings"));
        open.setPackage(context.getPackageName());
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pending = PendingIntent.getActivity(context, appWidgetId, open, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        manager.updateAppWidget(appWidgetId, views);
    }
}
