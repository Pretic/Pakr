package com.webviewapp

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.widget.Button
import android.widget.CheckBox
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class DisclaimerActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_disclaimer)

        val prefs: SharedPreferences = getSharedPreferences("app_prefs", MODE_PRIVATE)
        if (prefs.getBoolean("disclaimer_agreed", false)) {
            proceed()
            return
        }

        val btnDecline = findViewById<Button>(R.id.btnDecline)
        val btnAccept = findViewById<Button>(R.id.btnAccept)
        val cbRemember = findViewById<CheckBox>(R.id.cbRemember)

        btnDecline.setOnClickListener {
            finishAffinity()
        }

        btnAccept.setOnClickListener {
            if (cbRemember.isChecked) {
                prefs.edit().putBoolean("disclaimer_agreed", true).apply()
            }
            proceed()
        }
    }

    private fun proceed() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }
}
