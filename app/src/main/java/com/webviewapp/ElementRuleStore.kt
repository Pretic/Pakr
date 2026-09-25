package com.webviewapp

import android.content.Context
import org.json.JSONArray

/** Uses the original preference keys so existing installations retain their rules. */
internal class ElementRuleStore(context: Context) {
    private val preferences = context.getSharedPreferences("element_blocker", Context.MODE_PRIVATE)

    @Synchronized
    fun load(host: String): String {
        val current = preferences.getString(host, null)
        if (current != null && isValid(current)) return current
        val backup = preferences.getString("$host:backup", null)
        if (backup != null && isValid(backup)) return backup
        // Return damaged data unchanged; the UI can explain it instead of silently deleting it.
        return current ?: "[]"
    }

    @Synchronized
    fun save(host: String, json: String): Boolean {
        if (!isValid(json)) return false
        val previous = preferences.getString(host, null)
        val backup = preferences.getString("$host:backup", null)
        return try {
            val edit = preferences.edit().putString(host, json)
            if (previous != null && isValid(previous)) edit.putString("$host:backup", previous)
            if (edit.commit()) {
                true
            } else {
                // commit() can update the memory cache even when disk writing fails.
                val restore = preferences.edit()
                if (previous == null) restore.remove(host) else restore.putString(host, previous)
                if (backup == null) restore.remove("$host:backup") else restore.putString("$host:backup", backup)
                restore.commit()
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    /** Copies rules into a new host without removing the old host's rules. */
    @Synchronized
    fun mergeCopy(sourceHost: String, targetHost: String): Int {
        if (sourceHost == targetHost) return 0
        return try {
            val source = JSONArray(load(sourceHost))
            val target = JSONArray(load(targetHost))
            if (!isValid(source.toString()) || !isValid(target.toString())) return -1

            val merged = JSONArray()
            val selectors = HashSet<String>()
            for (index in 0 until target.length()) {
                val rule = target.getJSONObject(index)
                merged.put(rule)
                selectors.add(rule.getString("selector"))
            }

            var added = 0
            for (index in 0 until source.length()) {
                if (merged.length() >= 200) break
                val rule = source.getJSONObject(index)
                if (selectors.add(rule.getString("selector"))) {
                    merged.put(rule)
                    added += 1
                }
            }
            if (added == 0) 0 else if (save(targetHost, merged.toString())) added else -1
        } catch (_: Exception) {
            -1
        }
    }

    private fun isValid(json: String): Boolean {
        if (json.length > 512_000) return false
        return try {
            val rules = JSONArray(json)
            if (rules.length() > 200) return false
            for (index in 0 until rules.length()) {
                val rule = rules.optJSONObject(index) ?: return false
                val selector = rule.opt("selector") as? String ?: return false
                if (selector.isBlank() || selector.length > 2048) return false
                val label = rule.opt("label")
                if (label is String && label.length > 120) return false
            }
            true
        } catch (_: Exception) {
            false
        }
    }
}
