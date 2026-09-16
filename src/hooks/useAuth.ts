import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/authService';
import { RiderUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<RiderUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = AuthService.subscribeAuthState(rider => {
      setUser(rider);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, pass: string) => {
    return AuthService.login(email, pass);
  }, []);

  const signUp = useCallback(async (email: string, pass: string) => {
    return AuthService.signUp(email, pass);
  }, []);

  const logout = useCallback(async () => {
    return AuthService.logout();
  }, []);

  return {
    user,
    loading,
    login,
    signUp,
    logout,
  };
}
