package kz.ottyaral.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Display;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Отты Арал — ойын WebGL арқылы WebView ішінде жұмыс істейді.
 * Бұл белсенділік толық экран режимін, экран жаңару жиілігін (30/60/120 Гц)
 * және дірілді басқарады.
 */
public class MainActivity extends Activity {

    private WebView webView;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private int requestedHz = 60;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }

        SharedPreferences prefs = getSharedPreferences("otty", Context.MODE_PRIVATE);
        requestedHz = prefs.getInt("hz", 60);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setHapticFeedbackEnabled(false);
        webView.setLongClickable(false);
        webView.setOnLongClickListener(new View.OnLongClickListener() {
            @Override public boolean onLongClick(View v) { return true; }
        });

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(false);
        }

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                android.util.Log.d("OttyAral", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");

        setContentView(webView);
        applyRefreshRate(requestedHz);
        hideSystemUi();

        webView.loadUrl("file:///android_asset/game/index.html");
    }

    /** Дисплейдің ең қолайлы режимін таңдаймыз (мысалы 120 Гц). */
    private void applyRefreshRate(int hz) {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            Window w = getWindow();
            Display d = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
            if (d == null) return;
            Display.Mode cur = d.getMode();
            Display.Mode best = null;
            float bestScore = Float.MAX_VALUE;
            for (Display.Mode m : d.getSupportedModes()) {
                if (m.getPhysicalWidth() != cur.getPhysicalWidth()
                        || m.getPhysicalHeight() != cur.getPhysicalHeight()) continue;
                float rate = m.getRefreshRate();
                // Сұралған жиіліктен кем емес, бірақ оған ең жақын режим.
                float score = rate + 0.5f >= hz ? (rate - hz) : 1000f + (hz - rate);
                if (score < bestScore) { bestScore = score; best = m; }
            }
            WindowManager.LayoutParams lp = w.getAttributes();
            if (best != null) {
                lp.preferredDisplayModeId = best.getModeId();
                lp.preferredRefreshRate = best.getRefreshRate();
            }
            w.setAttributes(lp);
        } catch (Throwable ignored) {
        }
    }

    private float maxRefreshRate() {
        try {
            Display d = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
            float max = 60f;
            if (Build.VERSION.SDK_INT >= 23 && d != null) {
                for (Display.Mode m : d.getSupportedModes()) max = Math.max(max, m.getRefreshRate());
            } else if (d != null) {
                max = d.getRefreshRate();
            }
            return max;
        } catch (Throwable t) {
            return 60f;
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.evaluateJavascript("window.onAndroidPause&&window.onAndroidPause()", null);
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("window.onAndroidResume&&window.onAndroidResume()", null);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null) {
            webView.evaluateJavascript("(window.onAndroidBack&&window.onAndroidBack())?'1':'0'", new android.webkit.ValueCallback<String>() {
                @Override
                public void onReceiveValue(String v) {
                    if (v == null || !v.contains("1")) moveTaskToBack(true);
                }
            });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /** JavaScript үшін көпір: діріл, экран жиілігі, шығу. */
    private class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                int dur = Math.max(5, Math.min(ms, 400));
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(VibrationEffect.createOneShot(dur, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(dur);
                }
            } catch (Throwable ignored) {
            }
        }

        @JavascriptInterface
        public void setRefreshRate(final int hz) {
            requestedHz = hz;
            getSharedPreferences("otty", Context.MODE_PRIVATE).edit().putInt("hz", hz).apply();
            ui.post(new Runnable() {
                @Override public void run() { applyRefreshRate(hz); }
            });
        }

        @JavascriptInterface
        public float getMaxRefreshRate() {
            return maxRefreshRate();
        }

        @JavascriptInterface
        public void exitGame() {
            ui.post(new Runnable() {
                @Override public void run() { finishAndRemoveTask(); }
            });
        }
    }
}
