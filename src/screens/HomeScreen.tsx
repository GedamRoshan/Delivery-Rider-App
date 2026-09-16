import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RiderUser } from '../types';
import { useDutyTracking } from '../hooks/useDutyTracking';
import { useLocationLogs } from '../hooks/useLocationLogs';
import { LocationCard } from '../components/LocationCard';
import { LogItem } from '../components/LogItem';
import { PermissionModal } from '../components/PermissionModal';
import { PermissionService } from '../services/permissionService';

interface HomeScreenProps {
  user: RiderUser;
  onLogout: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ user, onLogout }) => {
  const { isOnDuty, metrics, isToggling, toggleDuty } = useDutyTracking(
    user.uid
  );
  const {
    logs,
    loading,
    error,
    isRefreshing,
    refreshLogs,
    pendingCount,
    isOnline,
    flushNow,
  } = useLocationLogs(user.uid);

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(true);

  // Check background permission on mount and when on-duty
  useEffect(() => {
    PermissionService.checkPermissions().then(status => {
      setHasBackgroundPermission(status.hasBackground);
    });
  }, [isOnDuty]);

  const handleDutyToggle = async (val: boolean) => {
    console.log(`\n🔄 [HomeScreen] Rider clicked Duty switch -> ${val ? 'ON DUTY' : 'OFF DUTY'}`);
    if (val) {
      // Check permissions first; if foreground not granted, show modal
      const status = await PermissionService.checkPermissions();
      console.log('🛡️ [HomeScreen] Current Permission status:', status);
      if (!status.hasForeground) {
        console.log('⚠️ [HomeScreen] Foreground location permission missing, showing modal.');
        setShowPermissionModal(true);
        return;
      }
      if (!status.hasBackground) {
        console.warn('⚠️ [HomeScreen] Background location not granted yet ("Allow all the time"). Tracking will run in foreground.');
      }
    }
    toggleDuty(val);
  };

  const handleGrantPermissionFromModal = async () => {
    setShowPermissionModal(false);
    const result = await PermissionService.requestPermissions();
    setHasBackgroundPermission(result.hasBackground);
    if (result.hasForeground) {
      toggleDuty(true);
    } else {
      PermissionService.openSettingsAlert();
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Log Out',
      isOnDuty
        ? 'You are currently On Duty. Logging out will stop background tracking. Proceed?'
        : 'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            if (isOnDuty) {
              await toggleDuty(false);
            }
            onLogout();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Permission Educational Rationale Modal */}
      <PermissionModal
        visible={showPermissionModal}
        onGrant={handleGrantPermissionFromModal}
        onDismiss={() => setShowPermissionModal(false)}
      />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarPill}>
            <Text style={styles.avatarIcon}>🛵</Text>
          </View>
          <View>
            <Text style={styles.riderRole}>DELIVERY RIDER</Text>
            <Text style={styles.riderEmail} numberOfLines={1}>
              {user.email || 'Rider Active'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Online/Offline Status Badge */}
          <View
            style={[
              styles.networkBadge,
              isOnline ? styles.networkBadgeOnline : styles.networkBadgeOffline,
            ]}
          >
            <View
              style={[
                styles.networkDot,
                isOnline ? styles.networkDotOnline : styles.networkDotOffline,
              ]}
            />
            <Text
              style={[
                styles.networkText,
                isOnline ? styles.networkTextOnline : styles.networkTextOffline,
              ]}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={confirmLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content List */}
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => <LogItem item={item} index={index} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshLogs}
            tintColor="#10B981"
            colors={['#10B981']}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Background Permission Notice Banner (if missing) */}
            {!hasBackgroundPermission && (
              <TouchableOpacity
                style={styles.permissionWarningCard}
                onPress={() => setShowPermissionModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.warningIcon}>⚠️</Text>
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>
                    Background Location Permission Needed
                  </Text>
                  <Text style={styles.warningSubtitle}>
                    Tap here to enable continuous tracking when the app is minimized.
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Duty Toggle Card */}
            <View
              style={[
                styles.dutyCard,
                isOnDuty ? styles.dutyCardActive : styles.dutyCardInactive,
              ]}
            >
              <View style={styles.dutyCardContent}>
                <View>
                  <Text style={styles.dutyLabel}>RIDER SHIFT STATUS</Text>
                  <Text style={styles.dutyStateText}>
                    {isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
                  </Text>
                  <Text style={styles.dutySubtext}>
                    {isOnDuty
                      ? 'Foreground service active • Polling GPS every 10s'
                      : 'Location tracking paused • Toggle to start shift'}
                  </Text>
                </View>

                <View style={styles.switchWrapper}>
                  {isToggling ? (
                    <ActivityIndicator color="#10B981" />
                  ) : (
                    <Switch
                      value={isOnDuty}
                      onValueChange={handleDutyToggle}
                      trackColor={{ false: '#334155', true: '#10B981' }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor="#334155"
                    />
                  )}
                </View>
              </View>
            </View>

            {/* Live Telemetry Card */}
            <LocationCard
              metrics={metrics}
              isOnDuty={isOnDuty}
              pendingCount={pendingCount}
              isOnline={isOnline}
              onFlush={flushNow}
            />

            {/* Section Header */}
            <View style={styles.feedHeader}>
              <View style={styles.feedTitleRow}>
                <Text style={styles.feedTitle}>Saved Location Logs</Text>
                <View style={styles.logCountBadge}>
                  <Text style={styles.logCountText}>{logs.length}</Text>
                </View>
              </View>
              <Text style={styles.feedSubtitle}>
                Filtered: ≥30m distance moves saved to Firebase
              </Text>
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Sync notice: {error}</Text>
                <TouchableOpacity
                  onPress={refreshLogs}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.stateTitle}>Loading waypoint stream...</Text>
            </View>
          ) : (
            <View style={styles.stateContainer}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>📍</Text>
              </View>
              <Text style={styles.stateTitle}>No Location Logs Yet</Text>
              <Text style={styles.stateDescription}>
                Toggle <Text style={styles.boldGreen}>On Duty</Text> above and
                move at least 30 meters. New qualifying fixes will automatically
                appear here in real time.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarPill: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarIcon: {
    fontSize: 20,
  },
  riderRole: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#10B981',
  },
  riderEmail: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 160,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  networkBadgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  networkBadgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkDotOnline: {
    backgroundColor: '#10B981',
  },
  networkDotOffline: {
    backgroundColor: '#EF4444',
  },
  networkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  networkTextOnline: {
    color: '#34D399',
  },
  networkTextOffline: {
    color: '#F87171',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 18,
    paddingBottom: 40,
  },
  permissionWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  warningIcon: {
    fontSize: 22,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  warningSubtitle: {
    fontSize: 12,
    color: '#FDE68A',
    marginTop: 2,
  },
  dutyCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  dutyCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  dutyCardInactive: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  dutyCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dutyLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  dutyStateText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  dutySubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    maxWidth: 240,
  },
  switchWrapper: {
    width: 60,
    alignItems: 'center',
  },
  feedHeader: {
    marginBottom: 12,
    marginTop: 6,
  },
  feedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  logCountBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  logCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  feedSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  stateDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  boldGreen: {
    color: '#10B981',
    fontWeight: '700',
  },
});
