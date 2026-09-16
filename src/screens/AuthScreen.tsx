import React, { useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { SignupScreen } from './SignupScreen';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  if (mode === 'signup') {
    return <SignupScreen onNavigateToLogin={() => setMode('login')} />;
  }

  return <LoginScreen onNavigateToSignup={() => setMode('signup')} />;
};

export { LoginScreen, SignupScreen };
