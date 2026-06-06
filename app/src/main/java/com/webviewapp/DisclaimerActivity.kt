package com.webviewapp

import android.content.Intent
import android.os.Bundle
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

        tvBody.text = buildString {
            appendLine("一、工具性质与适用范围")
            appendLine()
            appendLine("本工具由个人开发者独立开发并以开源方式发布，仅供技术学习、研究及个人合法用途使用，用于将合法网站快速封装为 Android 应用程序。本工具本身不存储、不处理、不传输任何用户数据，不内置任何网页内容，所有页面内容均由使用者自行填入的目标网址决定。")
            appendLine()
            appendLine("二、禁止用途（违者承担全部法律责任）")
            appendLine()
            appendLine("严禁将本工具用于以下任何用途，违者将承担相应刑事、民事及行政法律责任：")
            appendLine()
            appendLine("✕  制作、分发仿冒、钓鱼、诈骗类应用程序")
            appendLine("✕  冒充银行、证券、保险、支付机构或政府部门")
            appendLine("✕  封装赌博、彩票、色情、暴力或其他违法违规网站")
            appendLine("✕  侵犯第三方商标权、著作权、专利权或其他知识产权")
            appendLine("✕  窃取、收集或非法处理他人个人信息、账户密码、财产信息")
            appendLine("✕  传播谣言、虚假信息或扰乱公共秩序的内容")
            appendLine("✕  传播木马、病毒、恶意软件或任何有害程序")
            appendLine("✕  规避金融监管、实施非法集资或洗钱行为")
            appendLine("✕  任何其他违反中华人民共和国法律法规及使用者所在地法律的行为")
            appendLine()
            appendLine("三、开发者责任豁免声明")
            appendLine()
            appendLine("本工具以'现状'提供，开发者在法律允许的最大范围内明确声明：")
            appendLine()
            appendLine("1. 本工具仅提供技术封装能力，对使用者填入的网址内容、目标网站的合法性及其产生的后果不承担任何责任。")
            appendLine()
            appendLine("2. 使用者利用本工具实施的一切行为所产生的全部法律后果由使用者独立承担，与本工具开发者无关。")
            appendLine()
            appendLine("3. 开发者不对本工具的适用性、可靠性、安全性作出任何明示或默示担保，不对因使用本工具产生的任何直接或间接损失承担赔偿责任。")
            appendLine()
            appendLine("4. 若第三方因使用者的违规行为向开发者主张权利，使用者应自行承担全部责任并赔偿开发者因此遭受的一切损失（包括但不限于诉讼费、律师费、赔偿金）。")
            appendLine()
            appendLine("四、举报与配合执法")
            appendLine()
            appendLine("开发者保留对滥用行为向相关部门举报的权利，并承诺积极配合公安、网信、市场监管等执法机构依法开展的调查取证工作。一经发现使用本工具从事违法犯罪活动，开发者将立即终止相关服务并配合执法。")
            appendLine()
            appendLine("五、知识产权")
            appendLine()
            appendLine("本工具源代码、界面设计及相关技术文档的知识产权归开发者所有。使用者封装后的应用程序中所包含的第三方网站内容，其知识产权归原权利人所有，与本工具开发者无关。")
            appendLine()
            appendLine("六、免责警示")
            appendLine()
            append("网络空间不是法外之地。利用技术工具实施诈骗、侵权等违法行为，依据《中华人民共和国刑法》《网络安全法》《个人信息保护法》等法律法规，将面临刑事追诉、民事赔偿及行政处罚。请务必合法合规使用本工具。")
        }

        btnAccept.isEnabled = false
        btnAccept.alpha = 0.4f

        cbAgree.setOnCheckedChangeListener { _, checked ->
            btnAccept.isEnabled = checked
            btnAccept.animate().alpha(if (checked) 1f else 0.4f).setDuration(200).start()
        }

        btnDecline.setOnClickListener { finishAffinity() }
        btnAccept.setOnClickListener {
            // 记录已同意，下次启动不再显示
            getSharedPreferences("app_prefs", MODE_PRIVATE)
                .edit().putBoolean("disc_agreed", true).apply()
            startActivity(Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            finish()
        }
    }
}
