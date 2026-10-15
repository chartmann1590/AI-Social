package com.charles.aisocial.translate

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions
import com.google.mlkit.nl.languageid.LanguageIdentifier
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Wraps Google ML Kit's on-device translation + language identification APIs.
 *
 * Everything runs on-device: source text is never uploaded, and downloaded
 * language packs are stored locally via Google Play services. The recognizer
 * auto-detects the source language (with English as the default) and only
 * translates when the detected source differs from the requested target.
 */
class TranslateModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()
  private val translators = ConcurrentHashMap<String, Translator>()
  private val downloadsInFlight = ConcurrentHashMap.newKeySet<String>()

  private val languageIdentifier: LanguageIdentifier by lazy {
    LanguageIdentification.getClient(
      LanguageIdentificationOptions.Builder()
        .setConfidenceThreshold(0.55f)
        .build(),
    )
  }

  override fun getName(): String = "AISocialTranslate"

  companion object {
    private const val DOWNLOAD_TIMEOUT_SECONDS = 300L
    private const val TRANSLATE_TIMEOUT_SECONDS = 60L
    private const val SHORT_OP_TIMEOUT_SECONDS = 30L
  }

  private fun pairKey(source: String, target: String): String = "$source|$target"

  private fun isValidLanguageCode(code: String): Boolean =
    code.isNotBlank() && TranslateLanguage.getAllLanguages().contains(code)

  private fun translatorFor(source: String, target: String): Translator =
    translators.computeIfAbsent(pairKey(source, target)) {
      Translation.getClient(
        TranslatorOptions.Builder()
          .setSourceLanguage(source)
          .setTargetLanguage(target)
          .build(),
      )
    }

  @Throws(Exception::class)
  private fun ensureDownloaded(source: String, target: String) {
    val key = pairKey(source, target)
    if (downloadsInFlight.contains(key)) {
      return
    }
    downloadsInFlight.add(key)
    try {
      Tasks.await(translatorFor(source, target).downloadModelIfNeeded(), DOWNLOAD_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    } finally {
      downloadsInFlight.remove(key)
    }
  }

  @Throws(Exception::class)
  private fun detectLanguage(text: String): String {
    return try {
      val lang = Tasks.await(languageIdentifier.identifyLanguage(text), SHORT_OP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
      if (lang == "und" || !isValidLanguageCode(lang)) "" else lang
    } catch (_: Exception) {
      ""
    }
  }

  private fun resolveSource(text: String, sourceHint: String): String {
    val hint = sourceHint.trim()
    if (hint.isNotEmpty() && isValidLanguageCode(hint)) {
      return hint
    }
    val detected = detectLanguage(text)
    return if (detected.isNotEmpty()) detected else "en"
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(true)
  }

  /**
   * Translates 'text' into 'targetLanguage'.
   * 'sourceLanguage' is optional; when empty (or invalid) the source is
   * auto-detected. If the detected source equals the target, 'text' is returned
   * untouched. The language pack for the source to target pair is downloaded on
   * demand if it isn't already present.
   */
  @ReactMethod
  fun translate(text: String, targetLanguage: String, sourceLanguage: String, promise: Promise) {
    executor.execute {
      try {
        val target = targetLanguage.trim()
        if (!isValidLanguageCode(target)) {
          promise.reject("E_INVALID_TARGET", "Unsupported target language: $targetLanguage", null)
          return@execute
        }
        val original = text.trim()
        if (original.isEmpty()) {
          promise.resolve(text)
          return@execute
        }

        val source = resolveSource(original, sourceLanguage)
        if (source == target) {
          promise.resolve(text)
          return@execute
        }

        val translator = translatorFor(source, target)
        ensureDownloaded(source, target)
        val result = Tasks.await(translator.translate(original), TRANSLATE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("E_TRANSLATE", e.message, e)
      }
    }
  }

  /**
   * Pre-downloads the language pack for source→target (used when the user picks
   * their language during onboarding / in Settings). Resolves once the model is
   * available on-device.
   */
  @ReactMethod
  fun downloadLanguage(source: String, target: String, promise: Promise) {
    executor.execute {
      try {
        ensureDownloaded(source, target)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("E_DOWNLOAD", e.message, e)
      }
    }
  }

  @ReactMethod
  fun isLanguageDownloaded(source: String, target: String, promise: Promise) {
    executor.execute {
      try {
        val manager = com.google.mlkit.common.model.RemoteModelManager.getInstance()
        val model = TranslateRemoteModel.Builder(TranslateRemoteModel.translationCondition(source, target)).build()
        val result = Tasks.await(manager.isModelDownloaded(model), SHORT_OP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("E_STATUS", e.message, e)
      }
    }
  }

  /** Returns the list of downloaded translation model names, e.g. ["en|es"]. */
  @ReactMethod
  fun getDownloadedModels(promise: Promise) {
    executor.execute {
      try {
        val manager = com.google.mlkit.common.model.RemoteModelManager.getInstance()
        val models = Tasks.await(manager.getDownloadedModels(TranslateRemoteModel::class.java), SHORT_OP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        val arr = Arguments.createArray()
        for (model in models) {
          arr.pushString(model.remoteModelName)
        }
        promise.resolve(arr)
      } catch (e: Exception) {
        promise.reject("E_MODELS", e.message, e)
      }
    }
  }

  @ReactMethod
  fun deleteLanguage(source: String, target: String, promise: Promise) {
    executor.execute {
      try {
        val manager = com.google.mlkit.common.model.RemoteModelManager.getInstance()
        val model = TranslateRemoteModel.Builder(TranslateRemoteModel.translationCondition(source, target)).build()
        Tasks.await(manager.deleteDownloadedModel(model), SHORT_OP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        translators.remove(pairKey(source, target))
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_DELETE", e.message, e)
      }
    }
  }

  /** Closes cached translators (releases memory) and clears the download set. */
  @ReactMethod
  fun reset(promise: Promise) {
    executor.execute {
      try {
        for (translator in translators.values) {
          try {
            translator.close()
          } catch (_: Throwable) {
          }
        }
        translators.clear()
        downloadsInFlight.clear()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_RESET", e.message, e)
      }
    }
  }
}