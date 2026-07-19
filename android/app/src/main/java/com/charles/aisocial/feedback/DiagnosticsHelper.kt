package com.charles.aisocial.feedback

import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.app.ActivityManager
import java.text.SimpleDateFormat
import java.util.*

object DiagnosticsHelper {
    fun collect(context: Context): String {
        val appName = "AISocial"
        val packageName = context.packageName
        val versionName = try {
            context.packageManager.getPackageInfo(packageName, 0).versionName
        } catch (e: Exception) {
            "Unknown"
        }
        val versionCode = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                context.packageManager.getPackageInfo(packageName, 0).longVersionCode.toString()
            } else {
                context.packageManager.getPackageInfo(packageName, 0).versionCode.toString()
            }
        } catch (e: Exception) {
            "Unknown"
        }

        val brand = Build.BRAND
        val model = Build.MODEL
        val manufacturer = Build.MANUFACTURER
        val androidVersion = Build.VERSION.RELEASE
        val apiLevel = Build.VERSION.SDK_INT
        val locale = Locale.getDefault().toString()
        val timeZone = TimeZone.getDefault().id

        // Storage info
        val storageFreeGb = try {
            val stat = StatFs(Environment.getDataDirectory().path)
            val bytesAvailable = stat.blockSizeLong * stat.availableBlocksLong
            String.format(Locale.US, "%.2f GB", bytesAvailable.toDouble() / (1024 * 1024 * 1024))
        } catch (e: Exception) {
            "Unknown"
        }

        val storageTotalGb = try {
            val stat = StatFs(Environment.getDataDirectory().path)
            val bytesTotal = stat.blockSizeLong * stat.blockCountLong
            String.format(Locale.US, "%.2f GB", bytesTotal.toDouble() / (1024 * 1024 * 1024))
        } catch (e: Exception) {
            "Unknown"
        }

        // Memory info
        val memAvailableGb = try {
            val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)
            String.format(Locale.US, "%.2f GB", memInfo.availMem.toDouble() / (1024 * 1024 * 1024))
        } catch (e: Exception) {
            "Unknown"
        }

        val memTotalGb = try {
            val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)
            String.format(Locale.US, "%.2f GB", memInfo.totalMem.toDouble() / (1024 * 1024 * 1024))
        } catch (e: Exception) {
            "Unknown"
        }

        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", Locale.US).format(Date())

        return """
            ## Diagnostics

            - App: $appName
            - Package: $packageName
            - Version: $versionName ($versionCode)
            - Device: $model
            - Brand: $brand
            - Manufacturer: $manufacturer
            - Android: $androidVersion / API $apiLevel
            - Locale: $locale
            - Time Zone: $timeZone
            - Storage Free/Total: $storageFreeGb / $storageTotalGb
            - Memory Free/Total: $memAvailableGb / $memTotalGb
            - Timestamp: $timestamp
        """.trimIndent()
    }
}
