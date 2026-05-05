import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text as NativeText, View } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from 'react-native-google-mobile-ads';

import { ADMOB_AD_UNIT_IDS, ADMOB_REQUEST_OPTIONS } from './adMobConfig';
import { useAdMobReady } from './AdMobProvider';
import { useAdFreeStatus } from '../rewards/useAdFreeStatus';

export const FeedNativeAd = () => {
  const theme = useTheme();
  const ready = useAdMobReady();
  const { isAdFreeActive } = useAdFreeStatus();
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    if (!ready || isAdFreeActive) {
      return;
    }

    let cancelled = false;
    let loadedAd: NativeAd | null = null;

    NativeAd.createForAdRequest(ADMOB_AD_UNIT_IDS.native, ADMOB_REQUEST_OPTIONS)
      .then((ad) => {
        loadedAd = ad;
        if (cancelled) {
          ad.destroy();
          return;
        }
        setNativeAd(ad);
        console.log('AdMob native ad loaded');
      })
      .catch((error) => console.warn('AdMob native ad failed to load', error));

    return () => {
      cancelled = true;
      loadedAd?.destroy();
    };
  }, [isAdFreeActive, ready]);

  if (isAdFreeActive || !nativeAd) {
    return null;
  }

  return (
    <NativeAdView nativeAd={nativeAd} testID="admob-native" style={styles.nativeView}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            {nativeAd.icon?.url ? (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
              </NativeAsset>
            ) : (
              <View style={[styles.icon, { backgroundColor: theme.colors.surfaceVariant }]} />
            )}
            <View style={styles.headerText}>
              <View style={styles.labelRow}>
                <NativeText style={[styles.adBadge, { color: theme.colors.primary }]}>
                  Ad
                </NativeText>
                {nativeAd.advertiser ? (
                  <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                    <NativeText
                      numberOfLines={1}
                      style={[styles.advertiser, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {nativeAd.advertiser}
                    </NativeText>
                  </NativeAsset>
                ) : null}
              </View>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <NativeText style={[styles.headline, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {nativeAd.headline}
                </NativeText>
              </NativeAsset>
            </View>
          </View>

          {nativeAd.mediaContent ? (
            <NativeMediaView style={styles.media} />
          ) : null}

          <NativeAsset assetType={NativeAssetType.BODY}>
            <NativeText
              numberOfLines={3}
              style={[styles.body, { color: theme.colors.onSurfaceVariant }]}
            >
              {nativeAd.body}
            </NativeText>
          </NativeAsset>

          {nativeAd.callToAction ? (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <View
                style={[styles.cta, { backgroundColor: theme.colors.primary }]}
              >
                <NativeText style={[styles.ctaText, { color: theme.colors.onPrimary }]}>
                  {nativeAd.callToAction}
                </NativeText>
              </View>
            </NativeAsset>
          ) : null}
        </Card.Content>
      </Card>
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  nativeView: {
    marginHorizontal: 10,
    marginVertical: 6,
  },
  card: {
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  headerText: {
    flex: 1,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  adBadge: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  advertiser: {
    flexShrink: 1,
    fontSize: 12,
  },
  headline: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  icon: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
  media: {
    aspectRatio: 1.91,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
    width: '100%',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  cta: {
    alignItems: 'center',
    borderRadius: 6,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
