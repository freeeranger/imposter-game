package se.tjeneritz.imposter;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Forwards Android's predictive back gesture to the web app, so in-app layers
 * (pages, sheets, dialogs) can follow the swipe before back is committed.
 */
@CapacitorPlugin(name = "PredictiveBack")
public class PredictiveBackPlugin extends Plugin {

    private OnBackPressedCallback callback;

    @Override
    public void load() {
        callback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackStarted(BackEventCompat event) {
                notifyListeners("backStarted", toJs(event));
            }

            @Override
            public void handleOnBackProgressed(BackEventCompat event) {
                notifyListeners("backProgressed", toJs(event));
            }

            @Override
            public void handleOnBackCancelled() {
                notifyListeners("backCancelled", new JSObject());
            }

            @Override
            public void handleOnBackPressed() {
                notifyListeners("backInvoked", new JSObject());
            }
        };
        getActivity().runOnUiThread(() ->
            getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), callback)
        );
    }

    /**
     * Intercept back only while the app has something to close; otherwise Android
     * handles it and plays its own back-to-home preview.
     */
    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            callback.setEnabled(enabled);
            call.resolve();
        });
    }

    private JSObject toJs(BackEventCompat event) {
        JSObject data = new JSObject();
        data.put("progress", event.getProgress());
        data.put("edge", event.getSwipeEdge() == BackEventCompat.EDGE_LEFT ? "left" : "right");
        return data;
    }
}
