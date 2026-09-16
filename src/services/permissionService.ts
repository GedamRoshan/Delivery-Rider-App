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
        background = foreground;
      }

      return {
        hasForeground: foreground,
        hasBackground: background,
        canAskAgain: true,
      };
    } else {
      return new Promise(resolve => {
        Geolocation.getCurrentPosition(
          () => resolve({ hasForeground: true, hasBackground: true, canAskAgain: true }),
          err => {
            if (err.code === 1) {
              resolve({ hasForeground: false, hasBackground: false, canAskAgain: true });
            } else {
              resolve({ hasForeground: true, hasBackground: true, canAskAgain: true });
            }
          },
          { timeout: 2000, maximumAge: 60000, enableHighAccuracy: false }
        );
      });
    }
  }

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

    if (getAndroidApiLevel() >= 33) {
      try {
        await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS' as any
        );
      } catch (e) {
        console.warn('[PermissionService] POST_NOTIFICATIONS error:', e);
      }
    }

    let hasBackground = false;
    if (getAndroidApiLevel() >= 29) {
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
      Geolocation.requestAuthorization(
        () => {
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
