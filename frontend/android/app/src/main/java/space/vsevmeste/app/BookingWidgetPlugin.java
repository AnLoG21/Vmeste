package space.vsevmeste.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BookingWidget")
public class BookingWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String todayLine = call.getString("todayLine", "");
        String nextLine = call.getString("nextLine", "");
        String nextTime = call.getString("nextTime", "");
        BookingWidgetStore.write(getContext(), todayLine, nextLine, nextTime);
        BookingWidgetProvider.refreshAll(getContext());
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        BookingWidgetStore.clear(getContext());
        BookingWidgetProvider.refreshAll(getContext());
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }
}
