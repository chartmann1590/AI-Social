/**
 * Expo config plugin: on-device NSFW image check, two models:
 *   GantMan MobileNet V2 on LiteRT, and Marqo ViT-tiny (ONNX) on ONNX Runtime.
 *
 * - adds the LiteRT interpreter dependency
 * - copies native-src/safety/*.kt into the Android project and registers the package
 * - makes sure the model file is in android/app/src/main/assets/models/:
 *   copied from assets/models/ when present, otherwise downloaded from the
 *   model's public release (MIT, github.com/GantMan/nsfw_model) and checked
 *   against a pinned SHA-256. The build FAILS if the model cannot be put in
 *   place, so a release can never ship without the image safety check.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
  createRunOncePlugin,
} = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const LITERT = "    implementation 'com.google.ai.edge.litert:litert:1.4.0'";
const ORT = "    implementation 'com.microsoft.onnxruntime:onnxruntime-android:1.31.1'";
// Second model, committed to the repo (6 MB): Marqo nsfw-image-detection-384,
// Apache-2.0, exported + int8-quantized by scripts/build-marqo-nsfw-onnx.py.
const MARQO_NAME = 'nsfw_marqo_vit_tiny_384_int8.onnx';
const MARQO_SHA256 = '3c1e33461e41ee261334736021fb663e18e07f65e9ef186bd36ad578f64f3660';
const MODEL_NAME = 'nsfw_mobilenet_v2_224.tflite';
const MODEL_SHA256 = '380f98f7685f9d8a386f8cc595b6dfcb972989aae3d1b8b270d3a4a5b96fab40';
const MODEL_ZIP_URL =
  'https://github.com/GantMan/nsfw_model/releases/download/1.2.0/mobilenet_v2_140_224.1.zip';
const MODEL_ZIP_ENTRY = 'mobilenet_v2_140_224/saved_model.tflite';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function getAndroidPackage(config) {
  return config.android?.package ?? 'com.charles.aisocial';
}

function ensureModel(projectRoot, androidRoot) {
  const dest = path.join(androidRoot, 'app', 'src', 'main', 'assets', 'models', MODEL_NAME);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && sha256(dest) === MODEL_SHA256) return;

  const local = path.join(projectRoot, 'assets', 'models', MODEL_NAME);
  if (fs.existsSync(local) && sha256(local) === MODEL_SHA256) {
    fs.copyFileSync(local, dest);
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nsfw-model-'));
  const zip = path.join(tmp, 'model.zip');
  try {
    execFileSync('curl', ['-fsSL', '--retry', '3', '-o', zip, MODEL_ZIP_URL], { stdio: 'inherit' });
    try {
      execFileSync('unzip', ['-o', '-q', zip, MODEL_ZIP_ENTRY, '-d', tmp], { stdio: 'inherit' });
    } catch {
      // Windows 10+ ships bsdtar, which reads zip files.
      execFileSync('tar', ['-xf', zip, '-C', tmp, MODEL_ZIP_ENTRY], { stdio: 'inherit' });
    }
    const extracted = path.join(tmp, ...MODEL_ZIP_ENTRY.split('/'));
    const got = sha256(extracted);
    if (got !== MODEL_SHA256) {
      throw new Error(`NSFW model checksum mismatch (${got})`);
    }
    fs.copyFileSync(extracted, dest);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.copyFileSync(extracted, local);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (!fs.existsSync(dest) || sha256(dest) !== MODEL_SHA256) {
    throw new Error('NSFW image classifier model is missing; refusing to build without it.');
  }
}

function withNsfwClassifierInternal(config) {
  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes('com.google.ai.edge.litert:litert:')) {
      contents = contents.replace(/dependencies\s*\{/, `dependencies {\n${LITERT}`);
    }
    if (!contents.includes('com.microsoft.onnxruntime:onnxruntime-android:')) {
      contents = contents.replace(/dependencies\s*\{/, `dependencies {\n${ORT}`);
    }
    if (!contents.includes("noCompress += 'tflite'")) {
      contents = contents.replace(
        /androidResources\s*\{/,
        "androidResources {\n        noCompress += 'tflite'",
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    const pkg = getAndroidPackage(cfg);
    let src = cfg.modResults.contents;
    src = mergeContents({
      tag: 'aisocial-nsfw-classifier-import',
      src,
      newSrc: `import ${pkg}.safety.NsfwClassifierPackage`,
      anchor: /^import /m,
      offset: 0,
      comment: '//',
    }).contents;
    src = mergeContents({
      tag: 'aisocial-nsfw-classifier-pkg',
      src,
      newSrc: '              add(NsfwClassifierPackage())',
      anchor: /PackageList\(this\)\.packages\.apply\s*\{/,
      offset: 1,
      comment: '//',
    }).contents;
    cfg.modResults.contents = src;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const androidRoot = cfg.modRequest.platformProjectRoot;
      const pkg = getAndroidPackage(cfg);
      const srcDir = path.join(projectRoot, 'native-src', 'safety');
      const destDir = path.join(androidRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'), 'safety');
      fs.mkdirSync(destDir, { recursive: true });
      for (const f of fs.readdirSync(srcDir)) {
        if (!f.endsWith('.kt')) continue;
        const text = fs
          .readFileSync(path.join(srcDir, f), 'utf8')
          .replace(/^package com\.charles\.aisocial\.safety/m, `package ${pkg}.safety`);
        fs.writeFileSync(path.join(destDir, f), text);
      }
      ensureModel(projectRoot, androidRoot);
      const marqoSrc = path.join(projectRoot, 'assets', 'models', MARQO_NAME);
      const partsDir = path.join(projectRoot, 'assets', 'models', 'marqo-parts');
      if ((!fs.existsSync(marqoSrc) || sha256(marqoSrc) !== MARQO_SHA256) && fs.existsSync(partsDir)) {
        // Committed in <1 MB parts; join them in order.
        const parts = fs.readdirSync(partsDir).filter((f) => f.startsWith(`${MARQO_NAME}.part`)).sort();
        fs.writeFileSync(marqoSrc, Buffer.concat(parts.map((f) => fs.readFileSync(path.join(partsDir, f)))));
      }
      if (!fs.existsSync(marqoSrc) || sha256(marqoSrc) !== MARQO_SHA256) {
        throw new Error(`${MARQO_NAME} is missing or changed; refusing to build without the second image safety model.`);
      }
      fs.copyFileSync(marqoSrc, path.join(androidRoot, 'app', 'src', 'main', 'assets', 'models', MARQO_NAME));
      const selftest = path.join(projectRoot, 'assets', 'models', 'selftest.jpg');
      if (fs.existsSync(selftest)) {
        fs.copyFileSync(selftest, path.join(androidRoot, 'app', 'src', 'main', 'assets', 'models', 'selftest.jpg'));
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(withNsfwClassifierInternal, 'with-nsfw-classifier');
