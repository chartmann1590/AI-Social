import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import {
  Button,
  Card,
  Dialog,
  Divider,
  Icon,
  MD3Theme,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from 'react-native-paper';

import { ADMOB_AD_UNIT_IDS, ADMOB_REQUEST_OPTIONS } from '../ads/adMobConfig';
import { useAdMobReady } from '../ads/AdMobProvider';
import { useAdRewardsStore } from '../store';
import {
  AD_FREE_REDEMPTION_OPTIONS,
  AD_REWARD_DAILY_LIMIT,
  formatRewardDuration,
} from '../rewards/adFreeRewards';
import { useAdFreeStatus } from '../rewards/useAdFreeStatus';

const BEST_VALUE_OPTION_ID = 'focus';

export const RewardsScreen = () => {
  const theme = useTheme();
  const adMobReady = useAdMobReady();
  const credits = useAdRewardsStore((state) => state.credits);
  const earnedToday = useAdRewardsStore((state) => state.earnedToday);
  const redeemedToday = useAdRewardsStore((state) => state.redeemedToday);
  const hasSeenRewardsIntro = useAdRewardsStore((state) => state.hasSeenRewardsIntro);
  const earnCredit = useAdRewardsStore((state) => state.earnCredit);
  const redeemCredits = useAdRewardsStore((state) => state.redeemCredits);
  const markRewardsIntroSeen = useAdRewardsStore((state) => state.markRewardsIntroSeen);
  const refreshDailyLimits = useAdRewardsStore((state) => state.refreshDailyLimits);
  const { isAdFreeActive, remainingMs } = useAdFreeStatus();
  const canEarnToday = earnedToday < AD_REWARD_DAILY_LIMIT;
  const remainingRedeemCredits = Math.max(0, AD_REWARD_DAILY_LIMIT - redeemedToday);
  const rewarded = useRewardedAd(
    adMobReady && canEarnToday ? ADMOB_AD_UNIT_IDS.rewarded : null,
    ADMOB_REQUEST_OPTIONS,
  );
  const [pendingReward, setPendingReward] = useState(false);

  useEffect(() => {
    refreshDailyLimits();
  }, [refreshDailyLimits]);

  useEffect(() => {
    if (adMobReady && canEarnToday && !rewarded.isLoaded) {
      rewarded.load();
    }
  }, [adMobReady, canEarnToday, rewarded.isLoaded, rewarded.load]);

  useEffect(() => {
    if (rewarded.error) {
      console.warn('AdMob rewarded ad failed to load', rewarded.error);
    }
  }, [rewarded.error]);

  useEffect(() => {
    if (!pendingReward || !rewarded.isEarnedReward) {
      return;
    }

    const result = earnCredit();
    setPendingReward(false);

    if (result.ok) {
      Alert.alert('Credit earned', `You now have ${result.credits} ad-free credits.`);
      return;
    }

    Alert.alert('Daily limit reached', result.message);
  }, [earnCredit, pendingReward, rewarded.isEarnedReward]);

  useEffect(() => {
    if (!rewarded.isClosed) {
      return;
    }

    if (pendingReward && !rewarded.isEarnedReward) {
      setPendingReward(false);
      Alert.alert('Reward not earned', 'Finish the rewarded ad to earn a credit.');
    }

    if (adMobReady && canEarnToday) {
      rewarded.load();
    }
  }, [
    adMobReady,
    canEarnToday,
    pendingReward,
    rewarded.isClosed,
    rewarded.isEarnedReward,
    rewarded.load,
  ]);

  const adFreeStatusLabel = useMemo(() => {
    if (!isAdFreeActive) {
      return 'No active ad-free time';
    }

    return `${formatRewardDuration(remainingMs)} left`;
  }, [isAdFreeActive, remainingMs]);

  const watchRewardedAd = () => {
    refreshDailyLimits();

    const current = useAdRewardsStore.getState();

    if (current.earnedToday >= AD_REWARD_DAILY_LIMIT) {
      Alert.alert(
        'Daily limit reached',
        `You can earn up to ${AD_REWARD_DAILY_LIMIT} credits per day.`,
      );
      return;
    }

    if (!adMobReady) {
      Alert.alert('Ads unavailable', 'Rewarded ads are still initializing. Try again shortly.');
      return;
    }

    if (!rewarded.isLoaded) {
      rewarded.load();
      Alert.alert('Ad loading', 'The rewarded ad is not ready yet. Try again in a moment.');
      return;
    }

    setPendingReward(true);
    rewarded.show();
  };

  const redeem = (option: (typeof AD_FREE_REDEMPTION_OPTIONS)[number]) => {
    const result = redeemCredits(option.credits, option.durationMs);

    if (!result.ok) {
      Alert.alert('Cannot redeem', result.message);
      return;
    }

    const adFreeUntil = result.adFreeUntil ?? Date.now();

    Alert.alert(
      'Ad-free time added',
      `Automatic ads are hidden for ${formatRewardDuration(adFreeUntil - Date.now())}.`,
    );
  };

  const heroBackground = isAdFreeActive
    ? theme.colors.primaryContainer
    : theme.colors.surfaceVariant;
  const heroForeground = isAdFreeActive
    ? theme.colors.onPrimaryContainer
    : theme.colors.onSurfaceVariant;

  return (
    <>
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        <Text variant="headlineMedium" style={styles.title}>
          Rewards
        </Text>
        <Text variant="bodyMedium" style={[styles.blurb, { color: theme.colors.onSurfaceVariant }]}>
          Watch a rewarded ad to earn a credit, then redeem credits for temporary ad-free time
          across the app.
        </Text>

        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.surface }]}>
            <Icon
              source={isAdFreeActive ? 'shield-check' : 'shield-outline'}
              size={28}
              color={isAdFreeActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </View>
          <View style={styles.heroBody}>
            <Text variant="labelLarge" style={{ color: heroForeground }}>
              {isAdFreeActive ? 'Ad-free active' : 'Ad-free inactive'}
            </Text>
            <Text variant="headlineSmall" style={[styles.heroTitle, { color: heroForeground }]}>
              {adFreeStatusLabel}
            </Text>
            <Text variant="bodySmall" style={{ color: heroForeground, opacity: 0.85 }}>
              {isAdFreeActive
                ? 'Banners, native, and interstitial ads are hidden.'
                : 'Redeem credits below to hide automatic ads.'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBox
            label="Credits"
            value={String(credits)}
            icon="ticket-confirmation-outline"
            theme={theme}
            highlight
          />
          <StatBox
            label="Earned today"
            value={`${earnedToday}/${AD_REWARD_DAILY_LIMIT}`}
            icon="play-circle-outline"
            theme={theme}
          />
          <StatBox
            label="Used today"
            value={`${redeemedToday}/${AD_REWARD_DAILY_LIMIT}`}
            icon="timer-sand"
            theme={theme}
          />
        </View>

        <Card style={styles.card} mode="contained">
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderText}>
                <Text variant="titleMedium">Earn a credit</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Finish one rewarded ad to earn 1 credit. Resets daily.
                </Text>
              </View>
              <Button
                mode="contained"
                icon="play-circle"
                onPress={watchRewardedAd}
                disabled={!canEarnToday || pendingReward}
                loading={pendingReward || rewarded.isShowing}
              >
                {canEarnToday ? 'Watch ad' : 'Limit met'}
              </Button>
            </View>
            <ProgressBar
              progress={earnedToday / AD_REWARD_DAILY_LIMIT}
              style={styles.progress}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {Math.max(0, AD_REWARD_DAILY_LIMIT - earnedToday)} of {AD_REWARD_DAILY_LIMIT} earning
              credits left today.
            </Text>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Redeem ad-free time
        </Text>
        <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
          Up to {AD_REWARD_DAILY_LIMIT} credits redeemable per day. Redeeming while ad-free is
          active extends the timer.
        </Text>

        <View style={styles.optionGrid}>
          {AD_FREE_REDEMPTION_OPTIONS.map((option) => {
            const insufficientCredits = credits < option.credits;
            const overDailyLimit = remainingRedeemCredits < option.credits;
            const disabled = insufficientCredits || overDailyLimit;
            const isBestValue = option.id === BEST_VALUE_OPTION_ID;
            const tileBg = isBestValue
              ? theme.colors.secondaryContainer
              : theme.colors.surfaceVariant;
            const tileFg = isBestValue
              ? theme.colors.onSecondaryContainer
              : theme.colors.onSurfaceVariant;
            const disabledMessage = insufficientCredits
              ? `Need ${option.credits - credits} more credit${option.credits - credits === 1 ? '' : 's'}`
              : overDailyLimit
                ? `Daily redeem limit reached`
                : null;

            return (
              <Pressable
                key={option.id}
                onPress={() => !disabled && redeem(option)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.optionTile,
                  {
                    backgroundColor: tileBg,
                    borderColor: isBestValue ? theme.colors.primary : 'transparent',
                    opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Redeem ${option.label} for ${option.credits} credits`}
              >
                {isBestValue && (
                  <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onPrimary, fontWeight: '700' }}
                    >
                      BEST VALUE
                    </Text>
                  </View>
                )}
                <View style={styles.optionTileHeader}>
                  <Icon
                    source={isBestValue ? 'clock-star-four-points-outline' : 'clock-outline'}
                    size={22}
                    color={tileFg}
                  />
                  <View style={[styles.creditPill, { backgroundColor: theme.colors.surface }]}>
                    <Icon
                      source="ticket-confirmation"
                      size={14}
                      color={theme.colors.primary}
                    />
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.onSurface, marginLeft: 4 }}
                    >
                      {option.credits}
                    </Text>
                  </View>
                </View>
                <Text variant="headlineSmall" style={[styles.optionTitle, { color: tileFg }]}>
                  {option.label}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: tileFg, opacity: 0.85, marginBottom: 12 }}
                >
                  {option.description}
                </Text>
                {disabledMessage ? (
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.error, fontWeight: '600' }}
                  >
                    {disabledMessage}
                  </Text>
                ) : (
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.primary, fontWeight: '600' }}
                  >
                    Tap to redeem
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Divider style={styles.divider} />

        <Text variant="titleSmall" style={styles.sectionTitle}>
          How limits work
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Earn up to {AD_REWARD_DAILY_LIMIT} credits per day and redeem up to{' '}
          {AD_REWARD_DAILY_LIMIT} credits per day. Unused credits stay in your balance.
        </Text>
      </ScrollView>

      <Portal>
        <Dialog visible={!hasSeenRewardsIntro} dismissable={false}>
          <Dialog.Title>Ad-free rewards</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Watch rewarded ads to earn credits, then redeem credits for a temporary break from
              automatic ads. You can earn {AD_REWARD_DAILY_LIMIT} credits and redeem{' '}
              {AD_REWARD_DAILY_LIMIT} credits per day.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={markRewardsIntroSeen}>Got it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

interface StatBoxProps {
  label: string;
  value: string;
  icon: string;
  theme: MD3Theme;
  highlight?: boolean;
}

const StatBox = ({ label, value, icon, theme, highlight }: StatBoxProps) => {
  const bg = highlight ? theme.colors.primaryContainer : theme.colors.surfaceVariant;
  const fg = highlight ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant;
  const iconColor = highlight ? theme.colors.primary : theme.colors.onSurfaceVariant;

  return (
    <View style={[styles.statBox, { backgroundColor: bg }]}>
      <Icon source={icon} size={18} color={iconColor} />
      <Text variant="labelSmall" style={[styles.statLabel, { color: fg }]}>
        {label}
      </Text>
      <Text variant="titleLarge" style={{ color: fg, fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 6,
  },
  blurb: {
    marginBottom: 16,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
  },
  heroTitle: {
    marginTop: 2,
    marginBottom: 4,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    borderRadius: 12,
    flex: 1,
    minHeight: 90,
    justifyContent: 'space-between',
    padding: 12,
  },
  statLabel: {
    marginTop: 6,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  progress: {
    height: 8,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    marginBottom: 6,
    marginTop: 4,
  },
  helper: {
    marginBottom: 12,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  optionTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    minHeight: 170,
    position: 'relative',
  },
  optionTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  optionTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  divider: {
    marginVertical: 20,
  },
});
