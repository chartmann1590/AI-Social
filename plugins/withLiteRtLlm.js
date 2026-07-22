/**
 * Expo config plugin: MediaPipe tasks-genai (LLM Inference) + React Native bridge.
 * @param {import('@expo/config-types').ExpoConfig} config
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withMainApplication,
  createRunOncePlugin,
} = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const MEDIAPIPE_GENAI = "    implementation 'com.google.mediapipe:tasks-genai:0.10.27'";
const LITERT_LM = "    implementation 'com.google.ai.edge.litertlm:litertlm-android:0.10.0'";

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
  const litertPackage = `${applicationPackage}.litert`;

  const moduleKt = `package ${litertPackage}

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class LiteRtLlmModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()
  private val downloadExecutor = Executors.newSingleThreadExecutor()
  private val downloadCancelled = AtomicBoolean(false)

  // Only one engine is live at a time — either MediaPipe or LiteRT-LM.
  @Volatile private var mpInference: LlmInference? = null
  @Volatile private var litertEngine: Engine? = null
  private var lastModelPath: String? = null
  private var lastMaxTokens: Int = -1
  private var sessionTemperature: Float = 0.8f

  override fun getName(): String = "AISocialLiteRtLlm"

  private enum class Backend { MEDIAPIPE, LITERT_LM }

  /**
   * \`.litertlm\` → LiteRT-LM native runtime. \`.task\` → MediaPipe tasks-genai.
   * Extension is more reliable than magic-byte sniffing since LiteRT-LM has its own
   * binary container format that is not a FlatBuffer at file offset 0.
   */
  private fun detectBackend(path: String): Backend {
    val lower = path.lowercase()
    if (lower.endsWith(".litertlm")) return Backend.LITERT_LM
    return Backend.MEDIAPIPE
  }

  private fun closeAll() {
    try { mpInference?.close() } catch (_: Throwable) {}
    mpInference = null
    try { litertEngine?.close() } catch (_: Throwable) {}
    litertEngine = null
  }

  @ReactMethod
  fun initialize(modelPath: String, maxTokens: Int, temperature: Double, promise: Promise) {
    executor.execute {
      try {
        val path = modelPath.trim()
        if (path.isEmpty()) {
          promise.reject("E_INIT", "Empty model path", null)
          return@execute
        }
        sessionTemperature = temperature.toFloat()
        val unchanged =
          (mpInference != null || litertEngine != null) &&
            path == lastModelPath && maxTokens == lastMaxTokens
        if (unchanged) {
          promise.resolve(null)
          return@execute
        }

        closeAll()

        when (detectBackend(path)) {
          Backend.MEDIAPIPE -> {
            val options =
              LlmInference.LlmInferenceOptions.builder()
                .setModelPath(path)
                .setMaxTokens(maxTokens)
                .setMaxTopK(64)
                .build()
            mpInference = LlmInference.createFromOptions(reactApplicationContext, options)
          }
          Backend.LITERT_LM -> {
            val cfg = EngineConfig(modelPath = path)
            val engine = Engine(cfg)
            engine.initialize()
            litertEngine = engine
          }
        }
        lastModelPath = path
        lastMaxTokens = maxTokens
        promise.resolve(null)
      } catch (e: Throwable) {
        // Catch Throwable (not Exception): loading litertlm_jni throws
        // UnsatisfiedLinkError (an Error) on devices missing the native ABI.
        // Convert to a promise rejection so JS degrades gracefully instead of
        // crashing the app. (Crashlytics issue #7)
        promise.reject("E_INIT", e.message, e)
      }
    }
  }

  @ReactMethod
  fun isReady(promise: Promise) {
    promise.resolve(mpInference != null || litertEngine != null)
  }

  @ReactMethod
  fun generate(prompt: String, promise: Promise) {
    executor.execute {
      try {
        val mp = mpInference
        val lm = litertEngine
        when {
          mp != null -> {
            val sessionOptions =
              LlmInferenceSession.LlmInferenceSessionOptions.builder()
                .setTopK(40)
                .setTemperature(sessionTemperature)
                .build()
            val session = LlmInferenceSession.createFromOptions(mp, sessionOptions)
            try {
              session.addQueryChunk(prompt)
              promise.resolve(session.generateResponse())
            } finally {
              session.close()
            }
          }
          lm != null -> {
            lm.createConversation().use { conv ->
              val response: Message = conv.sendMessage(prompt)
              val text = response.contents.contents
                .filterIsInstance<Content.Text>()
                .joinToString("") { it.text }
              promise.resolve(text)
            }
          }
          else -> {
            promise.reject("E_GENERATE", "LLM not initialized", null)
          }
        }
      } catch (e: Exception) {
        promise.reject("E_GENERATE", e.message, e)
      }
    }
  }

  /**
   * Direct HTTP download via HttpURLConnection with generous timeouts so HF's
   * Xet CDN (which is slow to start streaming large LFS files) doesn't trip the
   * 10s read timeout that expo-file-system's OkHttp uses. Follows redirects
   * manually across https↔https.
   */
  @ReactMethod
  fun downloadFile(url: String, destPath: String, promise: Promise) {
    downloadCancelled.set(false)
    downloadExecutor.execute {
      var connection: HttpURLConnection? = null
      try {
        val outFile = File(destPath)
        outFile.parentFile?.mkdirs()
        if (outFile.exists()) outFile.delete()

        var currentUrl = URL(url)
        var redirects = 0
        while (true) {
          connection = (currentUrl.openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 120_000
            instanceFollowRedirects = false
            requestMethod = "GET"
          }
          val code = connection!!.responseCode
          if (code in 300..399) {
            val location = connection!!.getHeaderField("Location")
              ?: throw RuntimeException("Redirect $code with no Location header")
            connection!!.disconnect()
            if (++redirects > 5) throw RuntimeException("Too many redirects")
            currentUrl = URL(currentUrl, location)
            continue
          }
          if (code !in 200..299) {
            throw RuntimeException("HTTP $code from $currentUrl")
          }
          break
        }

        val conn = connection!!
        val total = conn.contentLengthLong
        conn.inputStream.use { input ->
          FileOutputStream(outFile).use { output ->
            val buf = ByteArray(64 * 1024)
            var written = 0L
            var lastEmit = 0L
            while (true) {
              if (downloadCancelled.get()) {
                throw RuntimeException("Download cancelled")
              }
              val n = input.read(buf)
              if (n < 0) break
              output.write(buf, 0, n)
              written += n
              if (written - lastEmit > 1_048_576) {
                lastEmit = written
                emitProgress(written, total)
              }
            }
            output.flush()
            emitProgress(written, total)
          }
        }
        promise.resolve(destPath)
      } catch (e: Exception) {
        promise.reject("E_DOWNLOAD", e.message, e)
      } finally {
        try { connection?.disconnect() } catch (_: Throwable) {}
      }
    }
  }

  @ReactMethod
  fun cancelDownload(promise: Promise) {
    downloadCancelled.set(true)
    promise.resolve(null)
  }

  private fun emitProgress(written: Long, total: Long) {
    try {
      val params = com.facebook.react.bridge.Arguments.createMap().apply {
        putDouble("written", written.toDouble())
        putDouble("total", total.toDouble())
      }
      reactApplicationContext
        .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("AISocialDownloadProgress", params)
    } catch (_: Throwable) {
      // RCTDeviceEventEmitter may not be ready during early init
    }
  }

  @ReactMethod
  fun addListener(eventName: String) { /* required for RN NativeEventEmitter */ }

  @ReactMethod
  fun removeListeners(count: Int) { /* required for RN NativeEventEmitter */ }

  @ReactMethod
  fun shutdown(promise: Promise) {
    executor.execute {
      try {
        closeAll()
        lastModelPath = null
        lastMaxTokens = -1
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_SHUTDOWN", e.message, e)
      }
    }
  }
}
`;

  const packageKt = `package ${litertPackage}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LiteRtLlmPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(LiteRtLlmModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

  return { moduleKt, packageKt, importLine: `import ${litertPackage}.LiteRtLlmPackage` };
}

function withLiteRtLlmInternal(config) {
  config = withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === 'expo.useLegacyPackaging',
    );

    if (existing) {
      existing.value = 'false';
    } else {
      cfg.modResults.push({
        type: 'property',
        key: 'expo.useLegacyPackaging',
        value: 'false',
      });
    }

    return cfg;
  });

  // Allow cleartext HTTP so users can point at a LAN / Tailscale Ollama server
  // (http://10.x / 192.168.x / 100.x). Without this, Android 9+ blocks the
  // fetch before it leaves the device and the user sees "Network request failed".
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let { contents } = cfg.modResults;
    if (!contents.includes('com.google.mediapipe:tasks-genai')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
${MEDIAPIPE_GENAI}`,
      );
    }
    if (!contents.includes('com.google.ai.edge.litertlm:litertlm-android')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
${LITERT_LM}`,
      );
    }
    if (!contents.includes('Xskip-metadata-version-check')) {
      contents +=
        `\n// LiteRT-LM 0.10 is published with Kotlin metadata 2.3; RN ships Kotlin 2.1.\n` +
        `// Skip the metadata check — we only call stable public API.\n` +
        `tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {\n` +
        `    compilerOptions {\n` +
        `        freeCompilerArgs.add("-Xskip-metadata-version-check")\n` +
        `    }\n` +
        `}\n`;
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
        tag: 'aisocial-litert-llm-import',
        anchor: /import expo\.modules\.ReactNativeHostWrapper/,
        offset: 1,
        newSrc: importLine,
      });
      if (!mergedImport.didMerge && !mergedImport.contents.includes(importLine)) {
        throw new Error(
          'withLiteRtLlm: could not find `import expo.modules.ReactNativeHostWrapper` in MainApplication.kt; add the LiteRt import manually.',
        );
      }
      contents = mergedImport.contents;
    }

    if (!contents.includes('add(LiteRtLlmPackage())')) {
      const mergedPkg = mergeContents({
        src: contents,
        comment: '//',
        tag: 'aisocial-litert-llm-pkg',
        anchor: /PackageList\(this\)\.packages\.apply \{/,
        offset: 1,
        newSrc: '              add(LiteRtLlmPackage())',
      });
      if (!mergedPkg.contents.includes('add(LiteRtLlmPackage())')) {
        throw new Error(
          'withLiteRtLlm: could not find `PackageList(this).packages.apply {` in MainApplication.kt; register LiteRtLlmPackage manually.',
        );
      }
      contents = mergedPkg.contents;
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
        'litert',
      );
      await fs.promises.mkdir(destDir, { recursive: true });
      await fs.promises.writeFile(path.join(destDir, 'LiteRtLlmModule.kt'), moduleKt, 'utf8');
      await fs.promises.writeFile(path.join(destDir, 'LiteRtLlmPackage.kt'), packageKt, 'utf8');
      return cfg;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(withLiteRtLlmInternal, 'with-lite-rt-llm');
