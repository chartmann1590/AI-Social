/**
 * Expo config plugin: ML Kit on-device translation (dynamic language packs) +
 * React Native bridge. Adds the ML Kit translate / language-id dependencies,
 * writes a small Kotlin module that wraps the ML Kit APIs, and registers it in
 * MainApplication.kt — mirroring the pattern used by `withLiteRtLlm.js`.
 *
 * Translation language models are downloaded at runtime (Google Play services)
 * and are stored on-device; text is never sent to a server.
 *
 * @param {import('@expo/config-types').ExpoConfig} config
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
  createRunOncePlugin,
} = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const MLKIT_TRANSLATE = "    implementation 'com.google.mlkit:translate:17.0.3'";
const MLKIT_LANGUAGE_ID = "    implementation 'com.google.mlkit:language-id:17.0.6'";

function getAndroidPackage(config) {
  return (
    config.android?.package ??
    config?.expo?.android?.package ??
    'com.charles.aisocial'
  );
}

/**
 * @param {string} applicationPackage e.g. com.charles.aisocial
 */
function writeNativeSources(applicationPackage) {
  const translatePackage = `${applicationPackage}.translate`;

  const moduleKt = `package ${translatePackage}

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
`;

  const packageKt = `package ${translatePackage}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class TranslatePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(TranslateModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

  return {
    moduleKt,
    packageKt,
    importLine: `import ${translatePackage}.TranslatePackage`,
  };
}

function withMLKitTranslateInternal(config) {
  config = withAppBuildGradle(config, (cfg) => {
    let { contents } = cfg.modResults;
    if (!contents.includes('com.google.mlkit:translate')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
${MLKIT_TRANSLATE}`,
      );
    }
    if (!contents.includes('com.google.mlkit:language-id')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
${MLKIT_LANGUAGE_ID}`,
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    const applicationPackage = getAndroidPackage(cfg);
    const { importLine } = writeNativeSources(applicationPackage);
    let contents = cfg.modResults.contents;

    if (!contents.includes(importLine)) {
      const mergedImport = mergeContents({
        src: contents,
        comment: '//',
        tag: 'aisocial-mlkit-translate-import',
        anchor: /import com\.charles\.aisocial\.feedback\.FeedbackPackage/,
        offset: 1,
        newSrc: importLine,
      });
      if (!mergedImport.didMerge && !mergedImport.contents.includes(importLine)) {
        // Fall back to anchoring near the LiteRT import when the feedback one is absent.
        const fallback = mergeContents({
          src: mergedImport.contents,
          comment: '//',
          tag: 'aisocial-mlkit-translate-import',
          anchor: /import com\.charles\.aisocial\.litert\.LiteRtLlmPackage/,
          offset: 1,
          newSrc: importLine,
        });
        if (!fallback.contents.includes(importLine)) {
          throw new Error(
            'withMLKitTranslate: could not anchor the TranslatePackage import in MainApplication.kt; add it manually.',
          );
        }
        contents = fallback.contents;
      } else {
        contents = mergedImport.contents;
      }
    }

    if (!contents.includes('add(TranslatePackage())')) {
      const mergedPkg = mergeContents({
        src: contents,
        comment: '//',
        tag: 'aisocial-mlkit-translate-pkg',
        anchor: /add\(FeedbackPackage\(\)\)/,
        offset: 1,
        newSrc: '              add(TranslatePackage())',
      });
      if (!mergedPkg.contents.includes('add(TranslatePackage())')) {
        const fallbackPkg = mergeContents({
          src: mergedPkg.contents,
          comment: '//',
          tag: 'aisocial-mlkit-translate-pkg',
          anchor: /PackageList\(this\)\.packages\.apply \{/,
          offset: 1,
          newSrc: '              add(TranslatePackage())',
        });
        if (!fallbackPkg.contents.includes('add(TranslatePackage())')) {
          throw new Error(
            'withMLKitTranslate: could not register TranslatePackage in MainApplication.kt; register it manually.',
          );
        }
        contents = fallbackPkg.contents;
      } else {
        contents = mergedPkg.contents;
      }
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const applicationPackage = getAndroidPackage(cfg);
      const { moduleKt, packageKt } = writeNativeSources(applicationPackage);
      const pkgPath = applicationPackage.replace(/\./g, '/');
      const destDir = path.join(
        projectRoot,
        'app',
        'src',
        'main',
        'java',
        pkgPath,
        'translate',
      );
      await fs.promises.mkdir(destDir, { recursive: true });
      await fs.promises.writeFile(path.join(destDir, 'TranslateModule.kt'), moduleKt, 'utf8');
      await fs.promises.writeFile(path.join(destDir, 'TranslatePackage.kt'), packageKt, 'utf8');
      return cfg;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(withMLKitTranslateInternal, 'with-mlkit-translate');