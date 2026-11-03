package __PACKAGE__;

import android.app.Activity;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SafeChatCapture")
public class SafeChatCapturePlugin extends Plugin {
    private Activity.ScreenCaptureCallback callback;

    @PluginMethod
    public void enable(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            JSObject result = new JSObject();
            result.put("supported", false);
            call.resolve(result);
            return;
        }

        getActivity().runOnUiThread(() -> {
            unregisterCallback();
            callback = () -> notifyListeners("screenshotDetected", new JSObject(), true);
            getActivity().registerScreenCaptureCallback(getActivity().getMainExecutor(), callback);
            JSObject result = new JSObject();
            result.put("supported", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            unregisterCallback();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        unregisterCallback();
        super.handleOnDestroy();
    }

    private void unregisterCallback() {
        if (Build.VERSION.SDK_INT >= 34 && callback != null) {
            getActivity().unregisterScreenCaptureCallback(callback);
            callback = null;
        }
    }
}
