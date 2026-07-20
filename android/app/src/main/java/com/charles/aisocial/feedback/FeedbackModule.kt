package com.charles.aisocial.feedback

import android.content.Intent
import com.charles.aisocial.BuildConfig
import com.charles.aisocial.data.feedback.CreateIssueRequest
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class FeedbackModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AISocialFeedback"

    @ReactMethod
    fun launchFeedback() {
        val intent = Intent(reactApplicationContext, FeedbackActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }

    /**
     * Reports a single AI-generated post/comment as an issue in the project's GitHub
     * tracker, via the same Cloudflare Worker proxy the bug-reporter uses. Runs
     * entirely on the native side so the proxy's shared secret never has to be
     * exposed to the JS bundle (which is trivially extractable from a decompiled APK,
     * unlike a compiled native BuildConfig constant).
     */
    @ReactMethod
    fun reportContent(
        contentType: String,
        content: String,
        reason: String,
        reasonLabel: String,
        note: String?,
        model: String?,
        promise: Promise,
    ) {
        val proxyBaseUrl = BuildConfig.GITHUB_PROXY_BASE_URL
        val appSecret = BuildConfig.GITHUB_PROXY_APP_SECRET
        val owner = BuildConfig.GITHUB_REPO_OWNER
        val repo = BuildConfig.GITHUB_REPO_NAME

        if (proxyBaseUrl.isNullOrEmpty() || appSecret.isNullOrEmpty()) {
            promise.reject("E_CONFIG", "Feedback proxy is not configured.")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val service = GithubClient.createService(proxyBaseUrl, appSecret)
                val title = "[Content Report] $reason ($contentType)"
                val bodyText = buildString {
                    append("## Reported ").append(contentType).append("\n\n")
                    append("> ").append(content.replace("\n", "\n> ")).append("\n\n")
                    append("## Reason\n\n").append(reason).append("\n\n")
                    if (!note.isNullOrBlank()) {
                        append("## Additional context\n\n").append(note).append("\n\n")
                    }
                    append("## Model\n\n").append(model?.ifBlank { "Unknown" } ?: "Unknown").append("\n")
                }
                val request = CreateIssueRequest(
                    title = title,
                    body = bodyText,
                    labels = listOf("content-report", reasonLabel),
                )
                val issue = service.createIssue(owner, repo, request)
                withContext(Dispatchers.Main) {
                    promise.resolve(issue.number.toDouble())
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("E_REPORT", e.message, e)
                }
            }
        }
    }
}
