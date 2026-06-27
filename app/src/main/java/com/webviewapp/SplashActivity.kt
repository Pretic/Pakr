package com.webviewapp

import android.annotation.SuppressLint
import android.graphics.Color
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

@SuppressLint("CustomSplashScreen")
class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        applyDisplayMode()
        setContentView(R.layout.activity_splash)

        Handler(Looper.getMainLooper()).postDelayed({
            val nextActivity = if (shouldShowDisclaimer()) {
                DisclaimerActivity::class.java
            } else {
                MainActivity::class.java
            }
            startActivity(Intent(this, nextActivity))
            finish()
        }, 800)
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

    private fun shouldShowDisclaimer(): Boolean {
        if (!SHOW_DISCLAIMER.equals("true", ignoreCase = true)) return false
        return !getSharedPreferences("app_prefs", MODE_PRIVATE)
            .getBoolean("disc_agreed", false)
    }

    companion object {
        private const val SHOW_DISCLAIMER = "{{SHOW_DISCLAIMER}}"
        private const val WINDOW_MODE = "{{WINDOW_MODE}}"
    }
}
