import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  AdsConsent,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

interface AdMobContextValue {
  ready: boolean;
}

const AdMobContext = createContext<AdMobContextValue>({ ready: false });
const TEST_DEVICE_IDENTIFIERS = ['EMULATOR', '4F3678767979EBACE313FAA15927A16B'];

export const AdMobProvider = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        return;
      }

      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.T,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
          testDeviceIdentifiers: TEST_DEVICE_IDENTIFIERS,
        });

        try {
          await AdsConsent.gatherConsent();
        } catch (error) {
          console.warn('AdMob consent gathering failed', error);
        }

        const consentInfo = await AdsConsent.getConsentInfo().catch(() => ({
          canRequestAds: true,
        }));

        if (!consentInfo.canRequestAds || startedRef.current || cancelled) {
          return;
        }

        startedRef.current = true;
        await mobileAds().initialize();

        if (!cancelled) {
          setReady(true);
          console.log('AdMob initialized');
        }
      } catch (error) {
        console.warn('AdMob initialization failed', error);
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdMobContext.Provider value={{ ready }}>
      {children}
    </AdMobContext.Provider>
  );
};

export const useAdMobReady = () => useContext(AdMobContext).ready;
