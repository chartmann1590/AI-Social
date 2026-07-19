package com.charles.aisocial.feedback

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.charles.aisocial.data.feedback.BugReport
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlinx.serialization.builtins.ListSerializer
import java.io.IOException

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "feedback_bug_reports")

class BugReportRepo(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private val bugReportsListKey = stringPreferencesKey("bug_reports_list")

    val bugReports: Flow<List<BugReport>> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            val jsonString = preferences[bugReportsListKey] ?: "[]"
            try {
                json.decodeFromString(ListSerializer(BugReport.serializer()), jsonString)
            } catch (e: Exception) {
                emptyList()
            }
        }

    suspend fun saveBugReport(report: BugReport) {
        val currentList = getBugReportsList().toMutableList()
        val index = currentList.indexOfFirst { it.number == report.number }
        if (index != -1) {
            currentList[index] = report
        } else {
            currentList.add(0, report) // Newest first
        }
        saveReportsList(currentList)
    }

    suspend fun updateBugReports(reports: List<BugReport>) {
        saveReportsList(reports)
    }

    suspend fun getBugReportsList(): List<BugReport> {
        val preferences = context.dataStore.data.first()
        val jsonString = preferences[bugReportsListKey] ?: "[]"
        return try {
            json.decodeFromString(ListSerializer(BugReport.serializer()), jsonString)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private suspend fun saveReportsList(reports: List<BugReport>) {
        val jsonString = json.encodeToString(ListSerializer(BugReport.serializer()), reports)
        context.dataStore.edit { preferences ->
            preferences[bugReportsListKey] = jsonString
        }
    }
}
