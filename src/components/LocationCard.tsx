import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { TrackingMetrics } from '../types';
import {
  formatCoordinates,
  formatDistance,
  formatTimestamp,
} from '../utils/formatters';

interface LocationCardProps {
  metrics: TrackingMetrics;
  isOnDuty: boolean;
  pendingCount: number;
  isOnline: boolean;
  onFlush: () => void;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  metrics,
  isOnDuty,
  pendingCount,
  isOnline,
  onFlush,
}) => {
  const isThresholdMet =
    metrics.lastDistanceDelta !== null && metrics.lastDistanceDelta >= 30;

  return (
    <View style={styles.container}>
      {/* Offline Queue Notice Banner */}
      {pendingCount > 0 && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineLeft}>
            <Text style={styles.offlineIcon}>📡</Text>
            <View>
              <Text style={styles.offlineTitle}>
                {pendingCount} {pendingCount === 1 ? 'Log' : 'Logs'} Queued Offline
              </Text>
              <Text style={styles.offlineSubtitle}>
                {isOnline
                  ? 'Connected — syncing automatically...'
                  : 'Will sync when connection returns'}
              </Text>
            </View>
          </View>
          {isOnline && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={onFlush}
              activeOpacity={0.7}
            >
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Header with Telemetry Status */}
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionLabel}>LIVE TELEMETRY</Text>
          <Text style={styles.title}>
            {isOnDuty ? 'Continuous GPS Polling' : 'GPS Inactive'}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            isOnDuty ? styles.statusPillActive : styles.statusPillInactive,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isOnDuty ? styles.statusDotActive : styles.statusDotInactive,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              isOnDuty ? styles.statusTextActive : styles.statusTextInactive,
            ]}
          >
            {isOnDuty ? '10s Cadence' : 'Off Duty'}
          </Text>
        </View>
      </View>

      {/* GPS Coordinate Display */}
      <View style={styles.coordsBox}>
        <Text style={styles.coordsLabel}>CURRENT FIX COORDINATES</Text>
        <Text style={styles.coordsValue}>
          {metrics.lastFixLat !== null && metrics.lastFixLng !== null
            ? formatCoordinates(metrics.lastFixLat, metrics.lastFixLng)
            : isOnDuty
            ? 'Acquiring GPS fix...'
            : 'Toggle On Duty to start fixes'}
        </Text>
        {metrics.lastFixTime && (
          <Text style={styles.fixTimestamp}>
            Last fix: {formatTimestamp(metrics.lastFixTime)}
          </Text>
        )}
      </View>

      {/* Threshold & Distance Delta Card */}
      <View style={styles.deltaRow}>
        <View style={styles.deltaBox}>
          <Text style={styles.statLabel}>LAST DELTA (≥30m RULE)</Text>
          {metrics.lastDistanceDelta !== null ? (
            <View style={styles.deltaValueRow}>
              <Text
                style={[
                  styles.deltaValue,
                  isThresholdMet ? styles.textSuccess : styles.textWarning,
                ]}
              >
                +{formatDistance(metrics.lastDistanceDelta)}
              </Text>
              <View
                style={[
                  styles.thresholdTag,
                  isThresholdMet ? styles.tagSuccess : styles.tagWarning,
                ]}
              >
                <Text
                  style={[
                    styles.thresholdTagText,
                    isThresholdMet ? styles.tagTextSuccess : styles.tagTextWarning,
                  ]}
                >
                  {isThresholdMet ? 'SAVED (≥30m)' : 'SKIPPED (<30m)'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.statEmpty}>Awaiting movement</Text>
          )}
        </View>
      </View>

      {/* Metrics Row: Total Distance & Total Saved Points */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TOTAL DISTANCE</Text>
          <Text style={styles.statNumber}>
            {formatDistance(metrics.totalDistanceMeters)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>SAVED WAYPOINTS</Text>
          <Text style={styles.statNumber}>{metrics.savedPointsCount}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18,
  },
  offlineBanner: {
    backgroundColor: '#3B2D18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  offlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  offlineIcon: {
    fontSize: 22,
  },
  offlineTitle: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '700',
  },
  offlineSubtitle: {
    color: '#FDE68A',
    fontSize: 11,
  },
  syncButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  statusPillInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderColor: '#475569',
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotInactive: {
    backgroundColor: '#64748B',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#34D399',
  },
  statusTextInactive: {
    color: '#94A3B8',
  },
  coordsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  coordsLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  coordsValue: {
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.3,
  },
  fixTimestamp: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  deltaRow: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  deltaBox: {
    gap: 4,
  },
  deltaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  deltaValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  textSuccess: {
    color: '#10B981',
  },
  textWarning: {
    color: '#F59E0B',
  },
  thresholdTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  tagWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  thresholdTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tagTextSuccess: {
    color: '#34D399',
  },
  tagTextWarning: {
    color: '#FBBF24',
  },
  statEmpty: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 3,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F1F5F9',
  },
});
