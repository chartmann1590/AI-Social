import React, { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import {
  BannerAd,
  BannerAdSize,
  useForeground,
} from 'react-native-google-mobile-ads';

import { ADMOB_AD_UNIT_IDS, ADMOB_REQUEST_OPTIONS } from './adMobConfig';
import { useAdMobReady } from './AdMobProvider';
import { useAdFreeStatus } from '../rewards/useAdFreeStatus';

export const AdMobBanner = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ready = useAdMobReady();
  const { isAdFreeActive } = useAdFreeStatus();
  const bannerRef = useRef<BannerAd>(null);

  useForeground(() => {
    if (Platform.OS === 'ios') {
      bannerRef.current?.load();
    }
  });

  if (!ready || isAdFreeActive) {
    return null;
  }

  return (
    <View
      testID="admob-banner"
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <BannerAd
        ref={bannerRef}
        unitId={ADMOB_AD_UNIT_IDS.banner}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        requestOptions={ADMOB_REQUEST_OPTIONS}
        onAdLoaded={() => console.log('AdMob banner loaded')}
        onAdFailedToLoad={(error) => console.warn('AdMob banner failed to load', error)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    width: '100%',
  },
});
