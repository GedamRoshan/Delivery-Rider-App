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

export const getFirebaseAuth = (): Auth => getAuth();

export class AuthService {
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

  public static subscribeAuthState(
    callback: (user: RiderUser | null) => void
  ): () => void {
    return this.subscribeToAuthState(callback);
  }

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

  public static async signUp(
    email: string,
    pass: string
  ): Promise<RiderUser> {
    return this.signup(email, pass);
  }

  public static async logout(): Promise<void> {
    const authInstance = getAuth();
    await signOut(authInstance);
  }

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
    } catch {}
    return null;
  }

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
