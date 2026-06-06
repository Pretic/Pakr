package com.webviewapp

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.widget.Button
import android.widget.CheckBox
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class DisclaimerActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        @Suppress("DEPRECATION")
        window.setFlags(
            android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN,
            android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        setContentView(R.layout.activity_disclaimer)

        val tvBody     = findViewById<TextView>(R.id.tvDisclaimerBody)
        val cbAgree    = findViewById<CheckBox>(R.id.cbAgree)
        val btnDecline = findViewById<Button>(R.id.btnDecline)
        val btnAccept  = findViewById<Button>(R.id.btnAccept)
        val scrollView = findViewById<android.widget.ScrollView>(R.id.scrollDisclaimer)

        tvBody.text = buildDisclaimerText()

        // 初始状态：未读完前 Checkbox 不可点击
        cbAgree.isEnabled = false
        cbAgree.alpha = 0.45f
        btnAccept.isEnabled = false
        btnAccept.alpha = 0.4f

        var hasScrolledToBottom = false

        // 监听滚动，滚到底部一次后永久解锁 Checkbox
        scrollView.setOnScrollChangeListener { v, _, scrollY, _, _ ->
            if (!hasScrolledToBottom) {
                val sv = v as android.widget.ScrollView
                val child = sv.getChildAt(0)
                val diff = child.bottom - (sv.height + scrollY)
                if (diff <= 8) {
                    hasScrolledToBottom = true
                    cbAgree.isEnabled = true
                    cbAgree.animate().alpha(1f).setDuration(200).start()
                }
            }
        }

        // 布局完成后检查内容是否本身就不超过屏幕（不需要滚动）
        scrollView.viewTreeObserver.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                scrollView.viewTreeObserver.removeOnGlobalLayoutListener(this)
                val child = scrollView.getChildAt(0)
                if (child != null && child.height <= scrollView.height) {
                    // 内容不需要滚动，直接解锁
                    hasScrolledToBottom = true
                    cbAgree.isEnabled = true
                    cbAgree.alpha = 1f
                }
            }
        })

        cbAgree.setOnCheckedChangeListener { _, checked ->
            btnAccept.isEnabled = checked
            if (!isFinishing) {
                btnAccept.animate().alpha(if (checked) 1f else 0.4f).setDuration(200).start()
            }
        }

        btnDecline.setOnClickListener { finishAffinity() }
        btnAccept.setOnClickListener {
            getSharedPreferences("app_prefs", MODE_PRIVATE)
                .edit().putBoolean("disc_agreed", true).apply()
            startActivity(Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            finish()
        }
    }

    private fun SpannableStringBuilder.appendBold(text: String): SpannableStringBuilder {
        val start = length
        append(text)
        setSpan(StyleSpan(Typeface.BOLD), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        return this
    }

    private fun SpannableStringBuilder.appendColored(text: String, color: Int): SpannableStringBuilder {
        val start = length
        append(text)
        setSpan(ForegroundColorSpan(color), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        return this
    }

    private fun SpannableStringBuilder.appendSmall(text: String): SpannableStringBuilder {
        val start = length
        append(text)
        setSpan(RelativeSizeSpan(0.85f), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        return this
    }

    private fun buildDisclaimerText(): SpannableStringBuilder {
        val sb = SpannableStringBuilder()

        // 一
        sb.appendBold("一、工具性质与适用范围")
        sb.append("\n\n")
        sb.append("Pakr（以下简称\"Pakr\"）由个人开发者ZSFan独立开发并以开源方式发布，仅供")
        sb.appendBold("技术学习、研究及个人合法用途")
        sb.append("使用，用于将合法网站快速封装为 Android 应用程序。Pakr本身不存储、不处理、不传输任何用户数据，不内置任何网页内容，所有页面内容均由使用者自行填入的目标网址决定。")
        sb.append("\n\n")

        // 二
        sb.appendBold("二、使用者身份确认")
        sb.append("\n\n")
        sb.append("使用Pakr即表示您确认：您已年满 18 周岁，具备完全民事行为能力；您将封装的网站属于您本人合法拥有或已获授权的网站；您已充分了解本声明全部内容并自愿受其约束。")
        sb.append("\n\n")

        // 三
        sb.appendBold("三、禁止用途（违者承担全部法律责任）")
        sb.append("\n\n")
        sb.append("严禁将Pakr用于以下任何用途，违者将承担相应刑事、民事及行政法律责任：\n\n")
        val bans = listOf(
            "制作、分发仿冒、钓鱼、诈骗类应用程序",
            "冒充银行、证券、保险、支付机构或政府部门",
            "封装赌博、彩票、色情、暴力或其他违法违规网站",
            "侵犯第三方商标权、著作权、专利权或其他知识产权",
            "窃取、收集或非法处理他人个人信息、账户密码、财产信息",
            "传播谣言、虚假信息或扰乱公共秩序的内容",
            "传播木马、病毒、恶意软件或任何有害程序",
            "规避金融监管、实施非法集资或洗钱行为",
            "任何其他违反中华人民共和国法律法规及使用者所在地法律的行为"
        )
        for (ban in bans) {
            sb.appendColored("✕  ", Color.parseColor("#EF4444"))
            sb.append(ban)
            sb.append("\n")
        }
        sb.append("\n")

        // 四
        sb.appendBold("四、开发者ZSFan责任豁免声明")
        sb.append("\n\n")
        sb.append("Pakr以\"现状\"提供，开发者ZSFan在法律允许的最大范围内明确声明：\n\n")
        sb.append("1. Pakr仅提供技术封装能力，对使用者填入的网址内容、目标网站合法性及其产生的后果")
        sb.appendBold("不承担任何责任")
        sb.append("。\n\n")
        sb.append("2. 使用者利用Pakr实施的一切行为所产生的")
        sb.appendBold("全部法律后果由使用者独立承担")
        sb.append("，与Pakr开发者ZSFan无关。\n\n")
        sb.append("3. 开发者ZSFan不对Pakr的适用性、可靠性、安全性作出任何明示或默示担保，不对因使用Pakr产生的任何直接或间接损失承担赔偿责任。\n\n")
        sb.append("4. 若第三方因使用者的违规行为向开发者ZSFan主张权利，使用者应自行承担全部责任并")
        sb.appendBold("赔偿开发者ZSFan因此遭受的一切损失")
        sb.append("（包括但不限于诉讼费、律师费、赔偿金）。")
        sb.append("\n\n")

        // 五
        sb.appendBold("五、举报与配合执法")
        sb.append("\n\n")
        sb.append("开发者ZSFan保留对滥用行为向相关部门举报的权利，并承诺积极配合公安、网信、市场监管等执法机构依法开展的调查取证工作。一经发现使用Pakr从事违法犯罪活动，开发者ZSFan将立即终止相关服务并配合执法。")
        sb.append("\n\n")

        // 六
        sb.appendBold("六、知识产权")
        sb.append("\n\n")
        sb.append("Pakr源代码、界面设计及相关技术文档的知识产权归开发者ZSFan所有。使用者封装后的应用程序中所包含的第三方网站内容，其知识产权归原权利人所有，与Pakr开发者ZSFan无关。")
        sb.append("\n\n")

        // 七（警告框 - 橙色背景）
        val warnStart = sb.length
        sb.appendBold("七、警告：")
        sb.append("网络空间不是法外之地。利用技术工具实施诈骗、侵权等违法行为，依据《中华人民共和国刑法》《网络安全法》《个人信息保护法》等法律法规，将面临刑事追诉、民事赔偿及行政处罚。请务必合法合规使用Pakr。")
        val warnEnd = sb.length
        sb.setSpan(ForegroundColorSpan(Color.parseColor("#92400E")), warnStart, warnEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        sb.setSpan(RelativeSizeSpan(0.93f), warnStart, warnEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)

        return sb
    }
}
