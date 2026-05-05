// When ANDROID_CI_KEYSTORE_PATH is set (GitHub Actions), release builds use that keystore.
const { createRunOncePlugin, withAppBuildGradle } = require('expo/config-plugins');

function withCiReleaseSigningInternal(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes('aisocial-ci-upload-keystore')) {
      return cfg;
    }

    contents = contents.replace(
      /signingConfigs\s*\{\s*\r?\n\s*debug\s*\{/,
      `signingConfigs {
        release {
            // aisocial-ci-upload-keystore
            def _ciKs = System.getenv("ANDROID_CI_KEYSTORE_PATH")
            if (_ciKs != null && !_ciKs.trim().isEmpty()) {
                storeFile file(_ciKs.trim())
                storePassword System.getenv("ANDROID_CI_KEYSTORE_PASSWORD") ?: ""
                keyAlias System.getenv("ANDROID_CI_KEY_ALIAS") ?: ""
                keyPassword System.getenv("ANDROID_CI_KEY_PASSWORD") ?: ""
            }
        }
        debug {`,
    );

    contents = contents.replace(
      /(\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\s*\r?\n)\s*signingConfig signingConfigs\.debug/,
      `$1            if (System.getenv("ANDROID_CI_KEYSTORE_PATH") != null && !System.getenv("ANDROID_CI_KEYSTORE_PATH").trim().isEmpty()) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
            }`,
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = createRunOncePlugin(withCiReleaseSigningInternal, 'with-ci-release-signing');
