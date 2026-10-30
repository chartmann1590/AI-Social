package com.charles.aisocial.safety

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.tensorflow.lite.Interpreter
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.concurrent.Executors

/**
 * On-device NSFW image classifier: two independent models,
 * GantMan MobileNet V2 (224x224, 5 classes: drawings, hentai, neutral,
 * porn, sexy; MIT) and Marqo nsfw-image-detection-384 (ViT-tiny, NSFW/SFW;
 * Apache-2.0). Every AI-generated or attached
 * image is run through this before it can be shown or posted; JS discards
 * anything flagged (see src/services/nsfwClassifier.ts).
 *
 * The image is scored as a whole and as several crops (center + four
 * quadrants) and the MAX score per class is returned, so explicit content
 * in one corner of an otherwise ordinary picture is still caught.
 * Any failure (model missing, decode error) rejects the promise, and JS
 * treats a rejection as "blocked" (fail closed).
 */
class NsfwClassifierModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val MODEL_ASSET = "models/nsfw_mobilenet_v2_224.tflite"
    private const val SIZE = 224
    private val LABELS = arrayOf("drawings", "hentai", "neutral", "porn", "sexy")

    // Second, independent model: Marqo nsfw-image-detection-384 (ViT-tiny,
    // Apache-2.0), exported to ONNX (int8), 384x384, inputs scaled to
    // [-1, 1], logits [NSFW, SFW]. Runs on ONNX Runtime.
    private const val MARQO_ASSET = "models/nsfw_marqo_vit_tiny_384_int8.onnx"
    private const val MARQO_SIZE = 384
  }

  private val executor = Executors.newSingleThreadExecutor()
  @Volatile private var interpreter: Interpreter? = null
  @Volatile private var marqoSession: OrtSession? = null
  private val ortEnv: OrtEnvironment by lazy { OrtEnvironment.getEnvironment() }

  override fun getName(): String = "AISocialSafety"

  @Synchronized
  private fun interp(): Interpreter {
    interpreter?.let { return it }
    val bytes = reactApplicationContext.assets.open(MODEL_ASSET).use { it.readBytes() }
    val buf = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
    buf.put(bytes)
    buf.rewind()
    val opts = Interpreter.Options().setNumThreads(2)
    val created = Interpreter(buf, opts)
    interpreter = created
    return created
  }

  @Synchronized
  private fun marqo(): OrtSession {
    marqoSession?.let { return it }
    val bytes = reactApplicationContext.assets.open(MARQO_ASSET).use { it.readBytes() }
    val opts = OrtSession.SessionOptions().apply { setIntraOpNumThreads(2) }
    val created = ortEnv.createSession(bytes, opts)
    marqoSession = created
    return created
  }

  /** Probability (0..1) that the image is NSFW according to the Marqo model. */
  private fun marqoNsfw(src: Bitmap): Float {
    val session = marqo()
    val n = MARQO_SIZE
    val scaled = Bitmap.createScaledBitmap(src, n, n, true)
    val px = IntArray(n * n)
    scaled.getPixels(px, 0, n, 0, 0, n, n)
    if (scaled !== src) scaled.recycle()
    // NCHW, scaled to [-1, 1] (mean 0.5, std 0.5).
    val fb = FloatBuffer.allocate(3 * n * n)
    for (ch in 0 until 3) {
      val shift = 16 - 8 * ch
      for (p in px) fb.put((((p shr shift) and 0xFF) / 255f - 0.5f) / 0.5f)
    }
    fb.rewind()
    val logits = OnnxTensor.createTensor(ortEnv, fb, longArrayOf(1, 3, n.toLong(), n.toLong())).use { t ->
      session.run(mapOf(session.inputNames.first() to t)).use { res ->
        @Suppress("UNCHECKED_CAST")
        (res.get(0).value as Array<FloatArray>)[0].copyOf()
      }
    }
    val a = logits[0]
    val b = logits[1]
    val m = maxOf(a, b)
    val ea = Math.exp((a - m).toDouble())
    val eb = Math.exp((b - m).toDouble())
    val p = (ea / (ea + eb)).toFloat()
    if (p.isNaN()) throw IllegalStateException("NaN score")
    return p
  }

  private fun openStream(uri: String): InputStream {
    val trimmed = uri.trim()
    return if (trimmed.startsWith("content://") || trimmed.startsWith("file://")) {
      reactApplicationContext.contentResolver.openInputStream(Uri.parse(trimmed))
        ?: throw IllegalStateException("Cannot open image")
    } else {
      java.io.FileInputStream(trimmed)
    }
  }

  private fun decode(uri: String): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    openStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw IllegalStateException("Not a decodable image")
    }
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= 512 && bounds.outHeight / (sample * 2) >= 512) {
      sample *= 2
    }
    val opts = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return openStream(uri).use { BitmapFactory.decodeStream(it, null, opts) }
      ?: throw IllegalStateException("Not a decodable image")
  }

  private fun score(src: Bitmap): FloatArray {
    val scaled = Bitmap.createScaledBitmap(src, SIZE, SIZE, true)
    val input = ByteBuffer.allocateDirect(4 * SIZE * SIZE * 3).order(ByteOrder.nativeOrder())
    val px = IntArray(SIZE * SIZE)
    scaled.getPixels(px, 0, SIZE, 0, 0, SIZE, SIZE)
    for (p in px) {
      input.putFloat(((p shr 16) and 0xFF) / 255f)
      input.putFloat(((p shr 8) and 0xFF) / 255f)
      input.putFloat((p and 0xFF) / 255f)
    }
    input.rewind()
    if (scaled !== src) scaled.recycle()
    val out = Array(1) { FloatArray(LABELS.size) }
    interp().run(input, out)
    return out[0]
  }

  /**
   * Startup self-test: classifies a bundled ordinary photo and logs the
   * scores (tag AISocialSafety). CI's emulator test checks this line, which
   * proves the model loads and runs on a real Android runtime.
   */
  @ReactMethod
  fun selfTest(promise: Promise) {
    executor.execute {
      try {
        val bmp = reactApplicationContext.assets.open("models/selftest.jpg").use {
          BitmapFactory.decodeStream(it)
        } ?: throw IllegalStateException("selftest image missing")
        val s = score(bmp)
        val mq = marqoNsfw(bmp)
        bmp.recycle()
        val line = LABELS.indices.joinToString(" ") { "${LABELS[it]}=%.4f".format(s[it]) } +
          " marqo_nsfw=%.4f".format(mq)
        Log.i("AISocialSafety", "NSFW classifier self-test ok $line")
        promise.resolve(true)
      } catch (e: Throwable) {
        Log.e("AISocialSafety", "NSFW classifier self-test FAILED: ${e.message}", e)
        promise.resolve(false)
      }
    }
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    executor.execute {
      try {
        interp()
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.resolve(false)
      }
    }
  }

  @ReactMethod
  fun classifyImage(uri: String, promise: Promise) {
    executor.execute {
      var bmp: Bitmap? = null
      try {
        bmp = decode(uri)
        val w = bmp.width
        val h = bmp.height
        val crops = listOf(
          intArrayOf(0, 0, w, h),
          intArrayOf(w * 15 / 100, h * 15 / 100, w * 70 / 100, h * 70 / 100),
          intArrayOf(0, 0, w / 2, h / 2),
          intArrayOf(w / 2, 0, w - w / 2, h / 2),
          intArrayOf(0, h / 2, w / 2, h - h / 2),
          intArrayOf(w / 2, h / 2, w - w / 2, h - h / 2),
        )
        // Per-region scores: index 0 = whole image, 1 = centre crop, 2..5 = quadrants.
        // JS applies the policy (src/services/nsfwPolicy.ts) to each region.
        val max = FloatArray(LABELS.size)
        val result = Arguments.createMap()
        val regions = Arguments.createArray()
        for ((i, c) in crops.withIndex()) {
          if (c[2] < 32 || c[3] < 32) continue
          val part = if (i == 0) bmp else Bitmap.createBitmap(bmp, c[0], c[1], c[2], c[3])
          val s = score(part)
          if (part !== bmp) part.recycle()
          val m = Arguments.createMap()
          for (k in s.indices) {
            if (s[k] > max[k]) max[k] = s[k]
            m.putDouble(LABELS[k], s[k].toDouble())
          }
          when (i) {
            0 -> {
              m.putDouble("marqo", marqoNsfw(bmp).toDouble())
              result.putMap("full", m)
            }
            1 -> {
              val cpart = Bitmap.createBitmap(bmp, c[0], c[1], c[2], c[3])
              m.putDouble("marqo", marqoNsfw(cpart).toDouble())
              cpart.recycle()
              result.putMap("center", m)
            }
            else -> regions.pushMap(m)
          }
        }
        for (k in LABELS.indices) result.putDouble(LABELS[k], max[k].toDouble())
        result.putArray("quadrants", regions)
        promise.resolve(result)
      } catch (e: Throwable) {
        // Throwable, not Exception: a missing native lib is an Error. JS treats
        // any rejection as "blocked", so the app never shows an unchecked image.
        promise.reject("E_CLASSIFY", e.message ?: "classification failed", e)
      } finally {
        try { bmp?.recycle() } catch (_: Throwable) {}
      }
    }
  }
}
