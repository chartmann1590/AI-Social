import Constants from 'expo-constants';
import { TestIds } from 'react-native-google-mobile-ads';
import type { RequestOptions } from 'react-native-google-mobile-ads';

const useTestAds = __DEV__;

type AdMobExtraConfig = {
  androidAppId?: string;
  bannerAdUnitId?: string;
  interstitialAdUnitId?: string;
  nativeAdUnitId?: string;
  rewardedAdUnitId?: string;
};

const adMobConfig = Constants.expoConfig?.extra?.adMob as AdMobExtraConfig | undefined;

const getProductionAdUnitId = (key: keyof Omit<AdMobExtraConfig, 'androidAppId'>) => {
  const value = adMobConfig?.[key];

  if (!value) {
    throw new Error(
      `Missing AdMob ${key}. Set android/local.properties locally, or ADMOB_* env / GitHub Actions secrets for CI.`,
    );
  }

  return value;
};

export const ADMOB_APP_ID = adMobConfig?.androidAppId;

export const ADMOB_AD_UNIT_IDS = {
  banner: useTestAds ? TestIds.BANNER : getProductionAdUnitId('bannerAdUnitId'),
  interstitial: useTestAds
    ? TestIds.INTERSTITIAL
    : getProductionAdUnitId('interstitialAdUnitId'),
  native: useTestAds ? TestIds.NATIVE : getProductionAdUnitId('nativeAdUnitId'),
  rewarded: useTestAds ? TestIds.REWARDED : getProductionAdUnitId('rewardedAdUnitId'),
};

export const ADMOB_REQUEST_OPTIONS: RequestOptions = {
  requestNonPersonalizedAdsOnly: true,
};
