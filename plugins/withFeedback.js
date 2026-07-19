const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
  withMainApplication,
  createRunOncePlugin,
} = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

function getAndroidPackage(config) {
  return (
    config.android?.package ??
    config?.expo?.android?.package ??
    'com.charles.aisocial'
  );
}

function withFeedbackInternal(config) {
  // 1.5. Root build.gradle configuration (classpaths)
  config = withProjectBuildGradle(config, (cfg) => {
    let { contents } = cfg.modResults;
    if (!contents.includes('org.jetbrains.kotlin:compose-compiler-gradle-plugin')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
        classpath "org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.1.20"
        classpath "org.jetbrains.kotlin:kotlin-serialization:2.1.20"`
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  // 1. AndroidManifest.xml registration
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.activity = app.activity || [];
      const alreadyRegistered = app.activity.some(
        (act) => act.$['android:name'] === '.feedback.FeedbackActivity'
      );
      if (!alreadyRegistered) {
        app.activity.push({
          $: {
            'android:name': '.feedback.FeedbackActivity',
            'android:theme': '@style/AppTheme',
            'android:configChanges': 'keyboard|keyboardHidden|orientation|screenSize',
            'android:exported': 'false',
          },
        });
      }
    }
    return cfg;
  });

  // 2. build.gradle configuration (dependencies + buildConfig + compose)
  config = withAppBuildGradle(config, (cfg) => {
    let { contents } = cfg.modResults;

    // Apply serialization & compose plugins
    if (!contents.includes('org.jetbrains.kotlin.plugin.compose')) {
      contents = contents.replace(
        /apply plugin: "org\.jetbrains\.kotlin\.android"/,
        `apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "org.jetbrains.kotlin.plugin.compose"
apply plugin: "org.jetbrains.kotlin.plugin.serialization"`
      );
    }

    // Enable Compose & BuildConfig build features
    if (!contents.includes('buildFeatures {')) {
      // Find android block opening and add buildFeatures
      contents = contents.replace(
        /android\s*\{/,
        `android {
    buildFeatures {
        buildConfig true
        compose true
    }`
      );
    } else {
      // If buildFeatures exists, make sure buildConfig & compose are true
      if (!contents.includes('buildConfig true')) {
        contents = contents.replace(/buildFeatures\s*\{/, 'buildFeatures {\n        buildConfig true');
      }
      if (!contents.includes('compose true')) {
        contents = contents.replace(/buildFeatures\s*\{/, 'buildFeatures {\n        compose true');
      }
    }

    // `local.properties` only auto-populates a handful of reserved keys (sdk.dir, ndk.dir).
    // Custom keys (github.*, etc.) are NOT exposed via `project.findProperty()` unless we
    // load the file ourselves — without this, every `findProperty('github.*')` below
    // silently returns null and the feedback tool looks "unconfigured" even when
    // local.properties has real values.
    if (!contents.includes('def localProperties = new Properties()')) {
      contents = contents.replace(
        /android\s*\{/,
        `def localProperties = new Properties()
def localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.withInputStream { localProperties.load(it) }
}

android {`
      );
    }

    // Inject buildConfig fields in defaultConfig
    if (!contents.includes('GITHUB_PROXY_BASE_URL')) {
      // The GitHub PAT itself never ships in the app — it lives only as a secret on the
      // Cloudflare Worker (cloudflare/github-proxy) that proxies these feedback-tool calls.
      // The app authenticates to *that* worker with a much lower-stakes shared secret.
      const buildConfigFields = `
        buildConfigField "String", "GITHUB_PROXY_BASE_URL", "\\"\${localProperties.getProperty('github.proxy.base_url') ?: System.getenv('GH_PROXY_BASE_URL') ?: ''}\\""
        buildConfigField "String", "GITHUB_PROXY_APP_SECRET", "\\"\${localProperties.getProperty('app.proxy.secret') ?: System.getenv('GH_PROXY_APP_SECRET') ?: ''}\\""
        buildConfigField "String", "GITHUB_REPO_OWNER", "\\"\${localProperties.getProperty('github.repo.owner') ?: System.getenv('GH_REPO_OWNER') ?: 'REPLACE_WITH_REPO_OWNER'}\\""
        buildConfigField "String", "GITHUB_REPO_NAME", "\\"\${localProperties.getProperty('github.repo.name') ?: System.getenv('GH_REPO_NAME') ?: 'REPLACE_WITH_REPO_NAME'}\\""
        buildConfigField "String", "FEEDBACK_ASSETS_DIR", "\\"feedback-assets\\""`;

      contents = contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {${buildConfigFields}`
      );
    }

    // Add necessary implementation dependencies
    const feedbackDeps = [
      "    implementation 'com.squareup.retrofit2:retrofit:2.9.0'",
      "    implementation 'com.squareup.okhttp3:okhttp:4.12.0'",
      "    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'",
      "    implementation 'androidx.datastore:datastore-preferences:1.0.0'",
      "    implementation 'org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3'",
      "    implementation 'com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0'",
      // Pinned to match what react-native/other deps already force compose.foundation to at
      // runtime. material3 1.2.1 predates Foundation's IndicationNodeFactory-based ripple API
      // and crashes every Feedback dialog with "clickable only supports IndicationNodeFactory
      // instances" once foundation is newer (check `./gradlew :app:dependencies` if this
      // needs bumping again).
      "    implementation 'androidx.compose.ui:ui:1.9.0'",
      "    implementation 'androidx.compose.material3:material3:1.4.0'",
      "    implementation 'androidx.compose.material:material-icons-core:1.7.8'",
      "    implementation 'androidx.compose.ui:ui-tooling-preview:1.9.0'",
      "    implementation 'androidx.activity:activity-compose:1.8.2'",
      "    implementation 'androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0'",
      "    implementation 'androidx.lifecycle:lifecycle-runtime-compose:2.7.0'"
    ].join('\n');

    if (!contents.includes('com.squareup.retrofit2:retrofit')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
${feedbackDeps}`
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  // 3. Register FeedbackPackage inside MainApplication.kt
  config = withMainApplication(config, (cfg) => {
    const applicationPackage = getAndroidPackage(cfg);
    const importLine = `import ${applicationPackage}.feedback.FeedbackPackage`;
    let contents = cfg.modResults.contents;

    if (!contents.includes(importLine)) {
      const mergedImport = mergeContents({
        src: contents,
        comment: '//',
        tag: 'aisocial-feedback-import',
        anchor: /import expo\.modules\.ReactNativeHostWrapper/,
        offset: 1,
        newSrc: importLine,
      });
      contents = mergedImport.contents;
    }

    if (!contents.includes('add(FeedbackPackage())')) {
      const mergedPkg = mergeContents({
        src: contents,
        comment: '//',
        tag: 'aisocial-feedback-pkg',
        anchor: /PackageList\(this\)\.packages\.apply \{/,
        offset: 1,
        newSrc: '              add(FeedbackPackage())',
      });
      contents = mergedPkg.contents;
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  // 4. Copy native source files
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const applicationPackage = getAndroidPackage(cfg);
      const pkgPath = applicationPackage.replace(/\./g, '/');

      const srcDir = path.join(cfg.modRequest.projectRoot, 'native-src', 'feedback');
      const destFeedbackDir = path.join(
        projectRoot,
        'app',
        'src',
        'main',
        'java',
        pkgPath,
        'feedback'
      );
      const destDataDir = path.join(
        projectRoot,
        'app',
        'src',
        'main',
        'java',
        pkgPath,
        'data',
        'feedback'
      );

      await fs.promises.mkdir(destFeedbackDir, { recursive: true });
      await fs.promises.mkdir(destDataDir, { recursive: true });

      // List of files to copy
      const feedbackFiles = [
        'GithubApi.kt',
        'DiagnosticsHelper.kt',
        'ImageUploadHelper.kt',
        'BugReportRepo.kt',
        'FeedbackModule.kt',
        'FeedbackPackage.kt',
        'FeedbackActivity.kt'
      ];
      
      const dataFiles = [
        'BugReport.kt',
        'GithubModels.kt'
      ];

      for (const file of feedbackFiles) {
        const fileContent = await fs.promises.readFile(path.join(srcDir, file), 'utf8');
        await fs.promises.writeFile(path.join(destFeedbackDir, file), fileContent, 'utf8');
      }

      for (const file of dataFiles) {
        const fileContent = await fs.promises.readFile(path.join(srcDir, file), 'utf8');
        await fs.promises.writeFile(path.join(destDataDir, file), fileContent, 'utf8');
      }

      return cfg;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(withFeedbackInternal, 'with-feedback');
