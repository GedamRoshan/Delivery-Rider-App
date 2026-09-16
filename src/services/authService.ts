import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
} from '@react-native-firebase/auth';
import { RiderUser } from '../types';

/**
 * Returns the native @react-native-firebase/auth instance
 */
export const getFirebaseAuth = (): Auth => getAuth();

export class AuthService {
  /**
   * Subscribes to Firebase auth state changes.
   * Session persists across app restarts using Firebase's native auth listener.
   */
  public static subscribeToAuthState(
    callback: (user: RiderUser | null) => void
  ): () => void {
    const authInstance = getAuth();
    const unsubscribe = onAuthStateChanged(
      authInstance,
      (user: User | null) => {
        if (user) {
          callback({
            uid: user.uid,
            email: user.email,
          });
        } else {
          callback(null);
        }
      },
      (error: Error) => {
        console.warn('[AuthService] onAuthStateChanged error:', error);
        callback(null);
      }
    );

    return unsubscribe;
  }

  // Alias for backward compatibility
  public static subscribeAuthState(
    callback: (user: RiderUser | null) => void
  ): () => void {
    return this.subscribeToAuthState(callback);
  }

  /**
   * Log in with Email & Password using @react-native-firebase/auth
   */
  public static async login(
    email: string,
    pass: string
  ): Promise<RiderUser> {
    const cleanEmail = email.trim();
    const authInstance = getAuth();
    const userCredential = await signInWithEmailAndPassword(
      authInstance,
      cleanEmail,
      pass
    );

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
    };
  }

  /**
   * Sign up with Email & Password using @react-native-firebase/auth
   */
  public static async signup(
    email: string,
    pass: string
  ): Promise<RiderUser> {
    const cleanEmail = email.trim();
    const authInstance = getAuth();
    const userCredential = await createUserWithEmailAndPassword(
      authInstance,
      cleanEmail,
      pass
    );

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
    };
  }

  // Alias for signup
  public static async signUp(
    email: string,
    pass: string
  ): Promise<RiderUser> {
    return this.signup(email, pass);
  }

  /**
   * Log out current rider using @react-native-firebase/auth signOut
   */
  public static async logout(): Promise<void> {
    const authInstance = getAuth();
    await signOut(authInstance);
  }

  /**
   * Get current authenticated user
   */
  public static getCurrentUser(): RiderUser | null {
    try {
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      if (user) {
        return {
          uid: user.uid,
          email: user.email,
        };
      }
    } catch {
      // If auth not yet initialized
    }
    return null;
  }

  /**
   * Helper to map Firebase Auth error codes to user-friendly messages
   */
  public static getFriendlyErrorMessage(error: any): string {
    if (!error) return 'An unexpected error occurred. Please try again.';

    const code = error.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
        return 'No rider account exists with this email.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please verify your credentials.';
      case 'auth/email-already-in-use':
        return 'This email address is already registered. Please log in.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Access is temporarily disabled. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      default:
        return error.message || 'Authentication failed. Please try again.';
    }
  }
}
