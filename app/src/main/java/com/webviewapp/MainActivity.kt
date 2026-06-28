package com.webviewapp

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Environment
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: TopProgressBar
    private lateinit var overlay: View
    private lateinit var spinner: IOSSpinnerView
    private lateinit var loadingText: TextView

    private val handler = Handler(Looper.getMainLooper())
    private var overlayVisible = false
    private var elementBlockerScript: String? = null
    private var nativeToolGestureActive = false
    private var nativeToolTriggered = false
    private var nativeToolStartX = 0f
    private var nativeToolStartY = 0f
    private val nativeToolLongPressDelayMs = 650L
    private val nativeToolMoveTolerancePx: Float by lazy { 12f * resources.displayMetrics.density }
    private val nativeToolEdgeWidthPx: Float by lazy { 28f * resources.displayMetrics.density }
    private val nativeToolLongPressRunnable = Runnable {
        if (!nativeToolGestureActive || nativeToolTriggered) return@Runnable
        nativeToolGestureActive = false
        nativeToolTriggered = true
        restoreSwipeRefreshState()
        openPakrToolMenuFromNative(nativeToolStartX, nativeToolStartY)
    }

    private val dotsFrames = arrayOf("", ".", "..", "...")
    private var dotsIndex = 0
    private val dotsRunnable = object : Runnable {
        override fun run() {
            loadingText.text = "加载中${dotsFrames[dotsIndex]}"
            dotsIndex = (dotsIndex + 1) % dotsFrames.size
            handler.postDelayed(this, 500)
        }
    }

    private val timeoutRunnable = Runnable { hideOverlay() }
    private val delayHideRunnable = Runnable { hideOverlay() }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        androidx.appcompat.app.AppCompatDelegate.setDefaultNightMode(
            androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_NO
        )
        super.onCreate(savedInstanceState)
        if (NO_SCREENSHOT.equals("true", ignoreCase = true)) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        applyDisplayMode()
        setContentView(R.layout.activity_main)
        webView     = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        overlay     = findViewById(R.id.overlay)
        spinner     = findViewById(R.id.spinner)
        loadingText = findViewById(R.id.loadingText)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        swipeRefresh.setColorSchemeColors(
            android.graphics.Color.parseColor("#6366F1")
        )
        swipeRefresh.setProgressViewOffset(false, 0, 160)
        swipeRefresh.setOnRefreshListener {
            forceShowOverlay()
            webView.reload()
        }
        showOverlay()
        setupWebView()
    }

    private fun applyDisplayMode() {
        if (WINDOW_MODE.equals("true", ignoreCase = true)) {
            configureWindowMode()
        } else {
            configureFullscreenMode()
        }
    }

    private fun configureFullscreenMode() {
        @Suppress("DEPRECATION")
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun configureWindowMode() {
        @Suppress("DEPRECATION")
        window.clearFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.WHITE
        window.navigationBarColor = Color.WHITE
        WindowInsetsControllerCompat(window, window.decorView).apply {
            show(WindowInsetsCompat.Type.systemBars())
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.setBackgroundColor(android.graphics.Color.WHITE)
        webView.settings.apply {
            javaScriptEnabled                = true
            domStorageEnabled                = true
            databaseEnabled                  = true
            useWideViewPort                  = true
            loadWithOverviewMode             = true
            setSupportZoom(false)
            builtInZoomControls              = false
            displayZoomControls              = false
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                handler.removeCallbacks(delayHideRunnable)
                applySavedFontScaleForUrl(url)
                forceShowOverlay()
            }

            override fun onPageCommitVisible(view: WebView, url: String) {
                injectWebViewEnhancements(view)
            }

            override fun onPageFinished(view: WebView, url: String) {
                swipeRefresh.isRefreshing = false
                fetchThemeColor(view)
                injectWebViewEnhancements(view)
                handler.removeCallbacks(delayHideRunnable)
                handler.postDelayed(delayHideRunnable, 300)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (e: Exception) {}
                    return true
                }
                return false
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    swipeRefresh.isRefreshing = false
                    handler.removeCallbacks(delayHideRunnable)
                    hideOverlay()
                    view.loadData(errorHtml(), "text/html", "UTF-8")
                }
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: android.webkit.WebResourceResponse) {
                if (request.isForMainFrame && errorResponse.statusCode >= 400) {
                    swipeRefresh.isRefreshing = false
                    handler.removeCallbacks(delayHideRunnable)
                    hideOverlay()
                    view.loadData(errorHtml(), "text/html", "UTF-8")
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progressBar.setProgress(newProgress)
                if (newProgress <= 5) showOverlay()
                if (newProgress >= 95) {
                    handler.removeCallbacks(delayHideRunnable)
                    handler.postDelayed(delayHideRunnable, 400)
                }
            }
            override fun onPermissionRequest(request: PermissionRequest) {
                request.grant(request.resources)
            }
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: WebChromeClient.FileChooserParams
            ): Boolean {
                fileChooserCallbackRef?.onReceiveValue(null)
                fileChooserCallbackRef = filePathCallback
                try {
                    val photoFile = java.io.File(
                        cacheDir,
                        "webview_uploads/camera_${System.currentTimeMillis()}.jpg"
                    ).also { it.parentFile?.mkdirs() }
                    cameraImageUri = androidx.core.content.FileProvider.getUriForFile(
                        this@MainActivity,
                        "${packageName}.fileprovider",
                        photoFile
                    )
                    val cameraIntent = android.content.Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                        putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraImageUri)
                        addFlags(android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    }
                    val fileIntent = fileChooserParams.createIntent()
                    val chooser = android.content.Intent.createChooser(fileIntent, "选择图片").apply {
                        putExtra(android.content.Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                    }
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST)
                } catch (e: Exception) {
                    filePathCallback.onReceiveValue(null)
                    fileChooserCallbackRef = null
                }
                return true
            }
        }
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            try {
                val uri = Uri.parse(url)
                val filename = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype)
                val req = DownloadManager.Request(uri).apply {
                    setMimeType(mimetype)
                    addRequestHeader("User-Agent", userAgent)
                    setDescription("正在下载...")
                    setTitle(filename)
                    allowScanningByMediaScanner()
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                }
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(req)
                android.widget.Toast.makeText(this, "开始下载：$filename", android.widget.Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {}
            }
        }
        // 键盘弹出适配：FLAG_FULLSCREEN 下 adjustResize 失效，手动监听 Insets
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(swipeRefresh) { view, insets ->
            val imeInsets = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime())
            val lp = view.layoutParams as android.widget.FrameLayout.LayoutParams
            lp.bottomMargin = imeInsets.bottom
            view.layoutParams = lp
            webView.setPadding(0, 0, 0, 0)
            insets
        }

        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun onThemeColor(hex: String) {
                try {
                    val color = android.graphics.Color.parseColor(hex)
                    runOnUiThread { progressBar.setBarColor(color) }
                } catch (e: Exception) {}
            }
        }, "ThemeBridge")
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun getRules(host: String): String {
                return getSharedPreferences("element_blocker", Context.MODE_PRIVATE)
                    .getString(normalizeRuleHost(host), "[]") ?: "[]"
            }

            @JavascriptInterface
            fun saveRules(host: String, rulesJson: String) {
                getSharedPreferences("element_blocker", Context.MODE_PRIVATE)
                    .edit()
                    .putString(normalizeRuleHost(host), rulesJson.take(50_000))
                    .apply()
            }

            @JavascriptInterface
            fun getFontScale(host: String): String {
                return getSharedPreferences("reader_settings", Context.MODE_PRIVATE)
                    .getString("${normalizeRuleHost(host)}:font_scale", "normal") ?: "normal"
            }

            @JavascriptInterface
            fun saveFontScale(host: String, scale: String) {
                val safeScale = normalizeFontScaleValue(scale)
                getSharedPreferences("reader_settings", Context.MODE_PRIVATE)
                    .edit()
                    .putString("${normalizeRuleHost(host)}:font_scale", safeScale)
                    .apply()
                runOnUiThread { setWebViewFontScale(safeScale) }
            }

            @JavascriptInterface
            fun applyFontScale(_host: String, scale: String) {
                runOnUiThread { setWebViewFontScale(normalizeFontScaleValue(scale)) }
            }

            @JavascriptInterface
            fun previewImage(url: String) {
                runOnUiThread { showImagePreview(url) }
            }

            @JavascriptInterface
            fun toast(message: String) {
                runOnUiThread {
                    android.widget.Toast.makeText(
                        this@MainActivity,
                        message.take(80),
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }, "PakrElementBlocker")
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun writeText(text: String?) {
                handler.post {
                    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("text", text.orEmpty()))
                }
            }
        }, "PakrClipboard")
        webView.settings.userAgentString = configuredUserAgent()
        installNativeToolEntry()
        webView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            swipeRefresh.isEnabled = scrollY == 0
        }
        webView.loadUrl(APP_URL)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun installNativeToolEntry() {
        webView.setOnGenericMotionListener { _, event ->
            if (isNativeSecondaryButtonEvent(event)) {
                cancelNativeToolGesture()
                openPakrToolMenuFromNative(event.x, event.y)
                true
            } else {
                false
            }
        }
        webView.setOnTouchListener { _, event ->
            if (isNativeSecondaryButtonEvent(event)) {
                cancelNativeToolGesture()
                openPakrToolMenuFromNative(event.x, event.y)
                return@setOnTouchListener true
            }
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    if (isNativeToolEdgeGestureStart(event)) startNativeToolEdgeGesture(event)
                }
                MotionEvent.ACTION_MOVE -> {
                    if (nativeToolGestureActive && nativeToolMovedBeyondTolerance(event)) {
                        cancelNativeToolGesture()
                    }
                }
                MotionEvent.ACTION_UP,
                MotionEvent.ACTION_CANCEL -> cancelNativeToolGesture()
            }
            false
        }
    }

    private fun isNativeSecondaryButtonEvent(event: MotionEvent): Boolean {
        return (event.buttonState and MotionEvent.BUTTON_SECONDARY) != 0 &&
            (event.actionMasked == MotionEvent.ACTION_BUTTON_PRESS ||
                event.actionMasked == MotionEvent.ACTION_DOWN)
    }

    private fun isNativeToolEdgeGestureStart(event: MotionEvent): Boolean {
        if (event.pointerCount != 1 || webView.width <= 0 || webView.height <= 0) return false
        val edgeStartX = (webView.width.toFloat() - nativeToolEdgeWidthPx).coerceAtLeast(0f)
        return event.x >= edgeStartX && event.x <= webView.width.toFloat() &&
            event.y >= 0f && event.y <= webView.height.toFloat()
    }

    private fun startNativeToolEdgeGesture(event: MotionEvent) {
        nativeToolGestureActive = true
        nativeToolTriggered = false
        nativeToolStartX = event.x.coerceIn(0f, webView.width.toFloat().coerceAtLeast(1f))
        nativeToolStartY = event.y.coerceIn(0f, webView.height.toFloat().coerceAtLeast(1f))
        webView.parent?.requestDisallowInterceptTouchEvent(true)
        swipeRefresh.isEnabled = false
        handler.removeCallbacks(nativeToolLongPressRunnable)
        handler.postDelayed(nativeToolLongPressRunnable, nativeToolLongPressDelayMs)
    }

    private fun nativeToolMovedBeyondTolerance(event: MotionEvent): Boolean {
        val dx = event.x - nativeToolStartX
        val dy = event.y - nativeToolStartY
        return dx * dx + dy * dy > nativeToolMoveTolerancePx * nativeToolMoveTolerancePx
    }

    private fun cancelNativeToolGesture() {
        handler.removeCallbacks(nativeToolLongPressRunnable)
        nativeToolGestureActive = false
        nativeToolTriggered = false
        webView.parent?.requestDisallowInterceptTouchEvent(false)
        restoreSwipeRefreshState()
    }

    private fun restoreSwipeRefreshState() {
        if (::swipeRefresh.isInitialized && ::webView.isInitialized) {
            swipeRefresh.isEnabled = webView.scrollY == 0
        }
    }

    private fun openPakrToolMenuFromNative(x: Float, y: Float) {
        val maxX = webView.width.toFloat().coerceAtLeast(1f)
        val maxY = webView.height.toFloat().coerceAtLeast(1f)
        val safeX = x.coerceIn(0f, maxX).toInt()
        val safeY = y.coerceIn(0f, maxY).toInt()
        val script = """
            (function() {
                if (window.PakrElementBlockerUI && window.PakrElementBlockerUI.openMenuAt) {
                    return window.PakrElementBlockerUI.openMenuAt($safeX, $safeY);
                }
                return false;
            })();
        """.trimIndent()
        webView.evaluateJavascript(script) { result ->
            if (result != "true") {
                injectWebViewEnhancements(webView)
                handler.postDelayed({ webView.evaluateJavascript(script, null) }, 80)
            }
        }
    }

    private fun configuredUserAgent(): String {
        return when (UA_MODE.lowercase()) {
            "android", "auto" -> ANDROID_MOBILE_UA
            "iphone" -> "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            "harmonyos" -> "Mozilla/5.0 (Linux; Android 12; HarmonyOS; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            "android_pad" -> "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            "ipad" -> "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            else -> ANDROID_MOBILE_UA
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showImagePreview(rawUrl: String) {
        val imageUrl = rawUrl.trim().take(8_000)
        if (!isPreviewableImageUrl(imageUrl)) {
            android.widget.Toast.makeText(this, "暂不支持预览此图片", android.widget.Toast.LENGTH_SHORT).show()
            return
        }

        imagePreviewDialog?.dismiss()

        val dialog = android.app.Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
        val previewWebView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.BLACK)
            settings.apply {
                javaScriptEnabled = false
                domStorageEnabled = false
                databaseEnabled = false
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(true)
                builtInZoomControls = true
                displayZoomControls = false
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }
        }
        val root = android.widget.FrameLayout(this).apply {
            setBackgroundColor(android.graphics.Color.BLACK)
            addView(
                previewWebView,
                android.widget.FrameLayout.LayoutParams(
                    android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                    android.widget.FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
        }
        val closeButton = TextView(this).apply {
            text = "×"
            textSize = 30f
            gravity = android.view.Gravity.CENTER
            setTextColor(android.graphics.Color.WHITE)
            setBackgroundColor(0x66000000)
            setOnClickListener { dialog.dismiss() }
        }
        val closeSize = (48 * resources.displayMetrics.density).toInt()
        val closeMargin = (16 * resources.displayMetrics.density).toInt()
        root.addView(
            closeButton,
            android.widget.FrameLayout.LayoutParams(closeSize, closeSize).apply {
                gravity = android.view.Gravity.TOP or android.view.Gravity.END
                topMargin = closeMargin
                marginEnd = closeMargin
            }
        )

        dialog.setContentView(root)
        dialog.setOnDismissListener {
            (previewWebView.parent as? android.view.ViewGroup)?.removeView(previewWebView)
            previewWebView.stopLoading()
            previewWebView.loadUrl("about:blank")
            previewWebView.destroy()
            if (imagePreviewDialog === dialog) imagePreviewDialog = null
        }
        imagePreviewDialog = dialog
        dialog.show()
        previewWebView.loadDataWithBaseURL(
            webView.url ?: imageUrl,
            imagePreviewHtml(imageUrl),
            "text/html",
            "UTF-8",
            null
        )
    }

    private fun isPreviewableImageUrl(url: String): Boolean {
        if (url.isBlank()) return false
        val scheme = try { Uri.parse(url).scheme?.lowercase() } catch (_: Exception) { null }
        return scheme == "http" || scheme == "https" || scheme == "data"
    }

    private fun normalizeFontScaleValue(scale: String): String {
        return when (scale) {
            "small", "normal", "large" -> scale
            else -> "normal"
        }
    }

    private fun setWebViewFontScale(scale: String) {
        webView.settings.textZoom = when (normalizeFontScaleValue(scale)) {
            "small" -> 90
            "large" -> 115
            else -> 100
        }
    }

    private fun applySavedFontScaleForUrl(url: String) {
        val host = try { Uri.parse(url).host ?: "local" } catch (_: Exception) { "local" }
        val scale = getSharedPreferences("reader_settings", Context.MODE_PRIVATE)
            .getString("${normalizeRuleHost(host)}:font_scale", "normal") ?: "normal"
        setWebViewFontScale(scale)
    }

    private fun imagePreviewHtml(imageUrl: String): String {
        val safeUrl = htmlEscape(imageUrl)
        return """
            <!doctype html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=8,user-scalable=yes">
              <style>
                html,body{margin:0;width:100%;height:100%;min-height:100%;background:#000;}
                body{display:grid;place-items:center;overflow:auto;box-sizing:border-box;}
                img{display:block;max-width:100vw;max-height:100vh;width:auto;height:auto;object-fit:contain;margin:auto;}
              </style>
            </head>
            <body><img src="$safeUrl" alt=""></body>
            </html>
        """.trimIndent()
    }

    private fun htmlEscape(value: String): String {
        return value
            .replace("&", "&amp;")
            .replace("\"", "&quot;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    }

    private fun normalizeRuleHost(host: String): String {
        val cleaned = host.lowercase().replace(Regex("[^a-z0-9._-]"), "_").take(255)
        return cleaned.ifBlank { "local" }
    }

    private fun fetchThemeColor(view: WebView) {
        val js = """
            (function() {
                var m = document.querySelector('meta[name="theme-color"]');
                if (m && m.content) { ThemeBridge.onThemeColor(m.content); return; }
                var el = document.elementFromPoint(window.innerWidth/2, 1);
                if (el) {
                    var bg = getComputedStyle(el).backgroundColor;
                    var r = bg.match(/rgba?\((\d+),(\d+),(\d+)/);
                    if (r) ThemeBridge.onThemeColor(
                        '#' + [r[1],r[2],r[3]].map(function(x){
                            return ('0' + parseInt(x).toString(16)).slice(-2);
                        }).join('')
                    );
                }
            })();
        """.trimIndent()
        view.evaluateJavascript(js, null)
    }

    private fun injectElementBlocker(view: WebView) {
        val script = try {
            elementBlockerScript ?: assets.open("pakr_element_blocker.js")
                .bufferedReader()
                .use { it.readText() }
                .also { elementBlockerScript = it }
        } catch (_: Exception) {
            return
        }
        view.evaluateJavascript(script, null)
    }

    private fun injectClipboardBridge(view: WebView) {
        val script = """
            (function() {
                if (window.__pakrClipboardBridgeReady) return;
                window.__pakrClipboardBridgeReady = true;

                function nativeWriteText(value) {
                    try {
                        if (window.PakrClipboard && window.PakrClipboard.writeText) {
                            window.PakrClipboard.writeText(String(value == null ? "" : value));
                            return Promise.resolve();
                        }
                    } catch (error) {
                        return Promise.reject(error);
                    }
                    return Promise.reject(new Error("Native clipboard bridge unavailable"));
                }

                var clipboard = {};
                try {
                    var current = navigator.clipboard || {};
                    Object.getOwnPropertyNames(current).forEach(function (key) {
                        try {
                            var value = current[key];
                            clipboard[key] = typeof value === "function" ? value.bind(current) : value;
                        } catch (_) {}
                    });
                } catch (_) {}
                clipboard.writeText = nativeWriteText;

                try {
                    Object.defineProperty(navigator, "clipboard", {
                        configurable: true,
                        get: function () { return clipboard; }
                    });
                } catch (_) {
                    try { navigator.clipboard = clipboard; } catch (ignored) {}
                }

                if (navigator.permissions && navigator.permissions.query) {
                    var originalQuery = navigator.permissions.query.bind(navigator.permissions);
                    navigator.permissions.query = function (descriptor) {
                        var name = descriptor && descriptor.name;
                        if (name === "clipboard-write" || name === "clipboard-read") {
                            return Promise.resolve({ state: "granted", onchange: null });
                        }
                        return originalQuery(descriptor);
                    };
                }

                document.addEventListener("copy", function () {
                    try {
                        var selected = window.getSelection && String(window.getSelection());
                        if (selected) nativeWriteText(selected);
                    } catch (_) {}
                }, true);
            })();
        """.trimIndent()
        view.evaluateJavascript(script, null)
    }

    private fun injectWebViewEnhancements(view: WebView) {
        injectClipboardBridge(view)
        injectElementBlocker(view)
    }

    private fun showOverlay() {
        if (overlayVisible) return
        overlayVisible = true
        overlay.animate().cancel()
        overlay.alpha = 1f
        overlay.visibility = View.VISIBLE
        progressBar.visibility = View.VISIBLE
        progressBar.setProgress(0)
        spinner.start()
        dotsIndex = 0
        handler.removeCallbacks(dotsRunnable)
        handler.post(dotsRunnable)
        handler.removeCallbacks(timeoutRunnable)
        handler.postDelayed(timeoutRunnable, 30_000L)
    }

    private fun forceShowOverlay() {
        overlayVisible = false
        showOverlay()
    }

    private fun hideOverlay() {
        if (!overlayVisible) return
        handler.removeCallbacks(timeoutRunnable)
        handler.removeCallbacks(dotsRunnable)
        overlayVisible = false
        overlay.animate().cancel()
        overlay.animate().alpha(0f).setDuration(300).withEndAction {
            if (!overlayVisible) {
                overlay.visibility = View.GONE
                spinner.stop()
                progressBar.visibility = View.GONE
            }
        }.start()
    }

    private fun errorHtml() = """
        <html><body style="margin:0;display:flex;align-items:center;justify-content:center;
        height:100vh;font-family:sans-serif;flex-direction:column;background:#fff;color:#333;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="margin-top:16px;font-size:15px;">网络连接失败</p>
        <button onclick="location.reload()"
          style="margin-top:12px;padding:10px 24px;border:none;border-radius:999px;
          background:#000;color:#fff;font-size:14px;cursor:pointer;">重试</button>
        </body></html>
    """.trimIndent()

    private var backPressedTime = 0L
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            val now = System.currentTimeMillis()
            if (now - backPressedTime < 2000) {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            } else {
                backPressedTime = now
                android.widget.Toast.makeText(this, "再按一次退出", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers()
        CookieManager.getInstance().flush()
    }

    override fun onStop() {
        super.onStop()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        fileChooserCallbackRef?.onReceiveValue(null)
        fileChooserCallbackRef = null
        imagePreviewDialog?.dismiss()
        imagePreviewDialog = null
        (webView.parent as? android.view.ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    private var fileChooserCallbackRef: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null
    private var imagePreviewDialog: android.app.Dialog? = null

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val results: Array<Uri>? = if (resultCode == RESULT_OK) {
                when {
                    (data == null || data.data == null) && cameraImageUri != null -> {
                        arrayOf(cameraImageUri!!)
                    }
                    data?.clipData != null -> {
                        val clip = data.clipData!!
                        Array(clip.itemCount) { i ->
                            clip.getItemAt(i).uri.also { uri ->
                                try {
                                    contentResolver.takePersistableUriPermission(
                                        uri,
                                        android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                                    )
                                } catch (_: Exception) {}
                            }
                        }
                    }
                    data?.data != null -> {
                        val uri = data.data!!
                        try {
                            contentResolver.takePersistableUriPermission(
                                uri,
                                android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                            )
                        } catch (_: Exception) {}
                        arrayOf(uri)
                    }
                    else -> null
                }
            } else null
            fileChooserCallbackRef?.onReceiveValue(results)
            fileChooserCallbackRef = null
            cameraImageUri = null
        }
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
    }

    companion object {
        const val APP_URL = "{{APP_URL}}"
        private const val NO_SCREENSHOT = "{{NO_SCREENSHOT}}"
        private const val WINDOW_MODE = "{{WINDOW_MODE}}"
        private const val UA_MODE = "{{UA_MODE}}"
        private const val ANDROID_MOBILE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        private const val FILE_CHOOSER_REQUEST = 1001
    }
}
