package com.webviewapp

import android.content.Context
import android.net.Uri
import org.json.JSONArray

/** Persistent app-level settings that survive upgrades of the same package. */
internal class AppSettingsStore(context: Context) {
    private val preferences = context.getSharedPreferences("pakr_app_settings", Context.MODE_PRIVATE)

    @Synchronized
    fun loadFavorites(): String {
        val current = preferences.getString(KEY_FAVORITES, null)
        if (current != null && isValidFavorites(current)) return current
        val backup = preferences.getString(KEY_FAVORITES_BACKUP, null)
        if (backup != null && isValidFavorites(backup)) return backup
        return "[]"
    }

    @Synchronized
    fun saveFavorites(json: String): Boolean {
        if (!isValidFavorites(json)) return false
        val previous = preferences.getString(KEY_FAVORITES, null)
        val previousBackup = preferences.getString(KEY_FAVORITES_BACKUP, null)
        val edit = preferences.edit().putString(KEY_FAVORITES, json)
        if (previous != null && isValidFavorites(previous)) {
            edit.putString(KEY_FAVORITES_BACKUP, previous)
        }
        return try {
            if (edit.commit()) {
                true
            } else {
                val restore = preferences.edit()
                if (previous == null) restore.remove(KEY_FAVORITES) else restore.putString(KEY_FAVORITES, previous)
                if (previousBackup == null) restore.remove(KEY_FAVORITES_BACKUP)
                else restore.putString(KEY_FAVORITES_BACKUP, previousBackup)
                restore.commit()
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    fun loadHomeUrl(defaultUrl: String): String {
        val saved = preferences.getString(KEY_HOME_URL, null)
        return normalizeHttpUrl(saved) ?: normalizeHttpUrl(defaultUrl) ?: defaultUrl
    }

    @Synchronized
    fun saveHomeUrl(url: String): Boolean {
        val normalized = normalizeHttpUrl(url) ?: return false
        val previous = preferences.getString(KEY_HOME_URL, null)
        return try {
            if (preferences.edit().putString(KEY_HOME_URL, normalized).commit()) {
                true
            } else {
                if (previous == null) preferences.edit().remove(KEY_HOME_URL).commit()
                else preferences.edit().putString(KEY_HOME_URL, previous).commit()
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    @Synchronized
    fun resetHomeUrl(): Boolean {
        val previous = preferences.getString(KEY_HOME_URL, null)
        return try {
            if (preferences.edit().remove(KEY_HOME_URL).commit()) {
                true
            } else {
                if (previous != null) preferences.edit().putString(KEY_HOME_URL, previous).commit()
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun isValidFavorites(json: String): Boolean {
        if (json.length > MAX_FAVORITES_JSON_LENGTH) return false
        return try {
            val favorites = JSONArray(json)
            if (favorites.length() > MAX_FAVORITES) return false
            for (index in 0 until favorites.length()) {
                val favorite = favorites.optJSONObject(index) ?: return false
                val url = favorite.opt("url") as? String ?: return false
                if (normalizeHttpUrl(url) == null || url.length > MAX_URL_LENGTH) return false
                val title = favorite.opt("title")
                if (title is String && title.length > MAX_TITLE_LENGTH) return false
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun normalizeHttpUrl(raw: String?): String? {
        val value = raw?.trim().orEmpty()
        if (value.isBlank() || value.length > MAX_URL_LENGTH) return null
        return try {
            val uri = Uri.parse(value)
            val scheme = uri.scheme?.lowercase()
            if ((scheme == "http" || scheme == "https") && !uri.host.isNullOrBlank()) {
                uri.toString()
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private companion object {
        const val KEY_FAVORITES = "favorites"
        const val KEY_FAVORITES_BACKUP = "favorites:backup"
        const val KEY_HOME_URL = "home_url"
        const val MAX_FAVORITES = 200
        const val MAX_FAVORITES_JSON_LENGTH = 512_000
        const val MAX_URL_LENGTH = 8_000
        const val MAX_TITLE_LENGTH = 200
    }
}
