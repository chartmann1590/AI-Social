const fs = require('fs');
const path = require('path');

const LOCAL_PROPERTIES_PATH = path.join(__dirname, 'android', 'local.properties');
const VERSION_CODE_FILE = path.join(__dirname, 'ci', 'play-store-version-code');

const REQUIRED_ADMOB_PROPERTIES = {
  androidAppId: 'admob.android_app_id',
  bannerAdUnitId: 'admob.banner_ad_unit_id',
  interstitialAdUnitId: 'admob.interstitial_ad_unit_id',
  nativeAdUnitId: 'admob.native_ad_unit_id',
  rewardedAdUnitId: 'admob.rewarded_ad_unit_id',
};

function readProperties(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}. Add the AdMob values before building.`);
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((properties, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return properties;
      }

      const separatorIndex = trimmed.search(/[:=]/);

      if (separatorIndex === -1) {
        return properties;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (key) {
        properties[key] = value;
      }

      return properties;
    }, {});
}

function requiredProperty(properties, key) {
  const value = properties[key]?.trim();

  if (!value) {
    throw new Error(`Missing ${key} in ${LOCAL_PROPERTIES_PATH}.`);
  }

  return value;
}

function booleanProperty(properties, key, defaultValue) {
  const value = properties[key]?.trim();

  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === 'true';
}

function envBool(name, defaultValue) {
  const value = process.env[name]?.trim();
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. For CI set GitHub Actions secrets (see .github/workflows/android-play-release.yml). For local dev use android/local.properties.`,
    );
  }
  return value;
}

/** When ADMOB_ANDROID_APP_ID is set (e.g. GitHub Actions secrets → env), skip local.properties. */
function readAdMobConfigFromEnv() {
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID?.trim();
  if (!androidAppId) {
    return null;
  }

  return {
    androidAppId,
    bannerAdUnitId: requiredEnv('ADMOB_BANNER_AD_UNIT_ID'),
    interstitialAdUnitId: requiredEnv('ADMOB_INTERSTITIAL_AD_UNIT_ID'),
    nativeAdUnitId: requiredEnv('ADMOB_NATIVE_AD_UNIT_ID'),
    rewardedAdUnitId: requiredEnv('ADMOB_REWARDED_AD_UNIT_ID'),
    delayAppMeasurementInit: envBool('ADMOB_DELAY_APP_MEASUREMENT_INIT', false),
    optimizeInitialization: envBool('ADMOB_OPTIMIZE_INITIALIZATION', true),
    optimizeAdLoading: envBool('ADMOB_OPTIMIZE_AD_LOADING', true),
  };
}

function readAdMobConfig() {
  const fromEnv = readAdMobConfigFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const properties = readProperties(LOCAL_PROPERTIES_PATH);

  return {
    androidAppId: requiredProperty(properties, REQUIRED_ADMOB_PROPERTIES.androidAppId),
    bannerAdUnitId: requiredProperty(properties, REQUIRED_ADMOB_PROPERTIES.bannerAdUnitId),
    interstitialAdUnitId: requiredProperty(
      properties,
      REQUIRED_ADMOB_PROPERTIES.interstitialAdUnitId,
    ),
    nativeAdUnitId: requiredProperty(properties, REQUIRED_ADMOB_PROPERTIES.nativeAdUnitId),
    rewardedAdUnitId: requiredProperty(properties, REQUIRED_ADMOB_PROPERTIES.rewardedAdUnitId),
    delayAppMeasurementInit: booleanProperty(
      properties,
      'admob.delay_app_measurement_init',
      true,
    ),
    optimizeInitialization: booleanProperty(properties, 'admob.optimize_initialization', true),
    optimizeAdLoading: booleanProperty(properties, 'admob.optimize_ad_loading', true),
  };
}

function readPlayStoreVersionCode() {
  const fromEnv = process.env.PLAY_STORE_VERSION_CODE?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) {
    return parseInt(fromEnv, 10);
  }

  if (fs.existsSync(VERSION_CODE_FILE)) {
    const raw = fs.readFileSync(VERSION_CODE_FILE, 'utf8').trim();
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0) {
      return Math.max(1, n);
    }
  }

  return 1;
}

module.exports = ({ config }) => {
  const adMob = readAdMobConfig();
  const versionCode = readPlayStoreVersionCode();

  return {
    ...config,
    android: {
      ...(config.android ?? {}),
      versionCode,
    },
    plugins: [
      ...(config.plugins ?? []),
      './plugins/withCiReleaseSigning.js',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: adMob.androidAppId,
          iosAppId:
            process.env.ADMOB_IOS_APP_ID?.trim() ||
            'ca-app-pub-3940256099942544~1458002511',
          delayAppMeasurementInit: adMob.delayAppMeasurementInit,
          optimizeInitialization: adMob.optimizeInitialization,
          optimizeAdLoading: adMob.optimizeAdLoading,
        },
      ],
    ],
    extra: {
      ...config.extra,
      adMob,
    },
  };
};
