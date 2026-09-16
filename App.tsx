import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/hooks/useAuth';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';

function AppContent() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.splashLogoBadge}>
          <Text style={styles.splashLogoIcon}>⚡</Text>
        </View>
        <Text style={styles.splashTitle}>RiderTrack</Text>
        <Text style={styles.splashSubtitle}>Initializing secure session...</Text>
        <ActivityIndicator
          size="small"
          color="#10B981"
          style={styles.splashSpinner}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {user ? <HomeScreen user={user} onLogout={logout} /> : <AuthScreen />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogoBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  splashLogoIcon: {
    fontSize: 36,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
  },
  splashSpinner: {
    marginTop: 24,
  },
});
