package com.webviewapp

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class DisclaimerActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyDisplayMode()
        setContentView(R.layout.activity_disclaimer)

        findViewById<TextView>(R.id.tvDisclaimerBody).text = buildString {
            appendLine("本应用仅供学习、研究和个人合法用途。")
            appendLine()
            appendLine("禁止用于：")
            appendLine()
            appendLine("× 制作仿冒、钓鱼或诈骗类应用")
            appendLine("× 封装违法、赌博等违规网站")
            appendLine("× 侵犯他人知识产权")
            appendLine("× 任何违反法律法规的行为")
            appendLine()
            append("使用本应用产生的一切法律责任由使用者自行承担。")
        }

        val scrollView = findViewById<android.widget.ScrollView>(R.id.scrollDisclaimer)
        val cbAgree = findViewById<CheckBox>(R.id.cbAgree)
        val btnAccept = findViewById<Button>(R.id.btnAccept)

        cbAgree.isEnabled = false
        cbAgree.alpha = 0.45f
        btnAccept.isEnabled = false
        btnAccept.alpha = 0.4f

        var hasScrolledToBottom = false

        fun unlockAgreement() {
            if (hasScrolledToBottom) return
            hasScrolledToBottom = true
            cbAgree.isEnabled = true
            cbAgree.animate().alpha(1f).setDuration(180).start()
        }

        fun isScrolledToBottom(): Boolean {
            val child = scrollView.getChildAt(0) ?: return true
            return child.bottom - (scrollView.height + scrollView.scrollY) <= 8
        }

        scrollView.viewTreeObserver.addOnScrollChangedListener {
            if (isScrolledToBottom()) unlockAgreement()
        }

        scrollView.viewTreeObserver.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                scrollView.viewTreeObserver.removeOnGlobalLayoutListener(this)
                if (isScrolledToBottom()) unlockAgreement()
            }
        })

        cbAgree.setOnCheckedChangeListener { _, checked ->
            btnAccept.isEnabled = checked
            if (!isFinishing) {
                btnAccept.animate().alpha(if (checked) 1f else 0.4f).setDuration(180).start()
            }
        }

        findViewById<Button>(R.id.btnDecline).setOnClickListener { finishAffinity() }
        btnAccept.setOnClickListener { proceed() }
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

    private fun proceed() {
        getSharedPreferences("app_prefs", MODE_PRIVATE)
            .edit()
            .putBoolean("disc_agreed", true)
            .apply()
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    companion object {
        private const val WINDOW_MODE = "{{WINDOW_MODE}}"
    }
}
