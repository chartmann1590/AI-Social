import { getCrashlytics, recordError, log as crashlyticsLog, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { getAnalytics, logEvent, setAnalyticsCollectionEnabled } from '@react-native-firebase/analytics';
import { getPerformance, trace } from '@react-native-firebase/perf';
import { AppState, type AppStateStatus } from 'react-native';

let initialized = false;

export async function initializeFirebase() {
  if (initialized) return;
  initialized = true;

  const crashlytics = getCrashlytics();
  const analytics = getAnalytics();
  const perf = getPerformance();

  await setCrashlyticsCollectionEnabled(crashlytics, true);
  await setAnalyticsCollectionEnabled(analytics, true);

  setupGlobalErrorHandlers(crashlytics);
  setupAppStateTracking(analytics, perf);
}

function setupGlobalErrorHandlers(crashlytics: ReturnType<typeof getCrashlytics>) {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    crashlyticsLog(crashlytics, `Fatal: ${error.message}`);
    recordError(crashlytics, error);
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

function setupAppStateTracking(
  analytics: ReturnType<typeof getAnalytics>,
  perf: ReturnType<typeof getPerformance>,
) {
  const handleAppState = (state: AppStateStatus) => {
    if (state === 'active') {
      logEvent(analytics, 'app_open');
    }
  };
  AppState.addEventListener('change', handleAppState);
}

/**
 * Starts a Firebase Performance trace for measuring startup/feature timing.
 * Returns a stop function that also records the elapsed duration in ms.
 */
export async function startPerfTrace(name: string) {
  try {
    const perf = getPerformance();
    const t = trace(perf, name);
    const startMs = Date.now();
    await t.start();
    return {
      stop: async () => {
        try {
          t.incrementMetric('duration_ms', Date.now() - startMs);
          await t.stop();
        } catch {
          // best-effort; never crash the app for a perf trace.
        }
      },
      trace: t,
    };
  } catch {
    return {
      stop: async () => {},
      trace: null,
    };
  }
}

export { getCrashlytics, getAnalytics, getPerformance, logEvent, recordError, crashlyticsLog };
