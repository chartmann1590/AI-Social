package com.charles.aisocial.feedback

import android.content.Context
import android.net.Uri
import android.util.Base64
import java.io.InputStream
import java.io.ByteArrayOutputStream

object ImageUploadHelper {
    fun uriToBase64(context: Context, uri: Uri): String {
        var inputStream: InputStream? = null
        try {
            inputStream = context.contentResolver.openInputStream(uri)
                ?: throw IllegalArgumentException("Could not open input stream for URI: $uri")
            val byteBuffer = ByteArrayOutputStream()
            val bufferSize = 1024
            val buffer = ByteArray(bufferSize)
            var len: Int
            while (inputStream.read(buffer).also { len = it } != -1) {
                byteBuffer.write(buffer, 0, len)
            }
            val bytes = byteBuffer.toByteArray()
            return Base64.encodeToString(bytes, Base64.NO_WRAP)
        } finally {
            try { inputStream?.close() } catch (_: Exception) {}
        }
    }
}
