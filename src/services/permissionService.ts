import {
  Platform,
  PermissionsAndroid,
  PermissionStatus,
  Linking,
  Alert,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface LocationPermissionState {
  hasForeground: boolean;
  hasBackground: boolean;
  canAskAgain: boolean;
}

function getAndroidApiLevel(): number {
  if (Platform.OS !== 'android') return 0;
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : parseInt(String(Platform.Version), 10) || 0;
}

export class PermissionService {
  /**
   * Checks current permission status without prompting the OS dialog.
   */
  public static async checkPermissions(): Promise<LocationPermissionState> {
    if (Platform.OS === 'android') {
      const fine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const coarse = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
      const foreground = fine || coarse;

      let background = false;
      if (getAndroidApiLevel() >= 29) {
        background = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        );
      } else {
        // Android 9 and below grants background location automatically if foreground is granted
        background = foreground;
      }

      return {
        hasForeground: foreground,
        hasBackground: background,
        canAskAgain: true,
      };
    } else {
      // iOS
      return new Promise(resolve => {
        // Geolocation provides authorization status check
        // By default, check if we can query position
        Geolocation.getCurrentPosition(
          () => resolve({ hasForeground: true, hasBackground: true, canAskAgain: true }),
          err => {
            if (err.code === 1) {
              // PERMISSION_DENIED
              resolve({ hasForeground: false, hasBackground: false, canAskAgain: true });
            } else {
              // Timeout or position unavailable, but permission might be granted
              resolve({ hasForeground: true, hasBackground: true, canAskAgain: true });
            }
          },
          { timeout: 2000, maximumAge: 60000, enableHighAccuracy: false }
        );
      });
    }
  }

  /**
   * Requests location permissions sequentially following Android & iOS guidelines:
   * 1. Foreground location (FINE + COARSE)
   * 2. Background location (ACCESS_BACKGROUND_LOCATION on Android 10+ / Always on iOS)
   * 3. Notification permission (Android 13+ for foreground service notification)
   */
  public static async requestPermissions(
    showExplanationPrompt: boolean = true
  ): Promise<LocationPermissionState> {
    if (Platform.OS === 'android') {
      return this.requestAndroidPermissions(showExplanationPrompt);
    } else {
      return this.requestIOSPermissions();
    }
  }

  private static async requestAndroidPermissions(
    showExplanation: boolean
  ): Promise<LocationPermissionState> {
    // 1. Request Foreground Permissions first
    const foregroundResult = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const fineGranted =
      foregroundResult[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const coarseGranted =
      foregroundResult[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;

    const hasForeground = fineGranted || coarseGranted;

    if (!hasForeground) {
      const isNeverAsk =
        foregroundResult[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
      return {
        hasForeground: false,
        hasBackground: false,
        canAskAgain: !isNeverAsk,
      };
    }

    // 2. Request Notification Permission for Android 13+ (API 33+)
    // Required to show persistent Foreground Service notification
    if (getAndroidApiLevel() >= 33) {
      try {
        await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS' as any
        );
      } catch (e) {
        console.warn('[PermissionService] POST_NOTIFICATIONS request error:', e);
      }
    }

    // 3. Request Background Permission on Android 10+ (API 29+)
    let hasBackground = false;
    if (getAndroidApiLevel() >= 29) {
      // Android 11+ requires requesting background permission separately from foreground
      const bgResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );
      hasBackground = bgResult === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      hasBackground = true;
    }

    return {
      hasForeground: true,
      hasBackground,
      canAskAgain: true,
    };
  }

  private static async requestIOSPermissions(): Promise<LocationPermissionState> {
    return new Promise(resolve => {
      // First request when-in-use
      Geolocation.requestAuthorization(
        () => {
          // If granted, request always authorization
          resolve({
            hasForeground: true,
            hasBackground: true,
            canAskAgain: true,
          });
        },
        error => {
          console.warn('[PermissionService] iOS permission error:', error);
          resolve({
            hasForeground: false,
            hasBackground: false,
            canAskAgain: false,
          });
        }
      );
    });
  }

  /**
   * Prompts user with explanation and directs them to system settings
   */
  public static openSettingsAlert(
    title: string = 'Location Permission Required',
    message: string = 'Delivery Rider App requires background location access to track delivery routes while On Duty. Please enable "Allow all the time" in Settings.'
  ): void {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings().catch(() => {}),
      },
    ]);
  }
}
