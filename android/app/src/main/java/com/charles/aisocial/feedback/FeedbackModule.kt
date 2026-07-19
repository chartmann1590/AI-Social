package com.charles.aisocial.feedback

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

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
}
