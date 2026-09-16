import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LocationLogEntry } from '../types';
import {
  formatCoordinates,
  formatDistance,
  formatTimestamp,
  formatFullDateTime,
} from '../utils/formatters';

interface LogItemProps {
  item: LocationLogEntry;
  index: number;
}

export const LogItem: React.FC<LogItemProps> = ({ item, index }) => {
  const isBaseline = item.distanceMoved === 0;

  return (
    <View style={styles.card}>
      <View style={styles.leftColumn}>
        <View style={styles.pointNumberBadge}>
          <Text style={styles.pointNumberText}>#{index + 1}</Text>
        </View>
        <View style={styles.verticalLine} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.timestamp}>{formatFullDateTime(item.timestamp)}</Text>
          <View
            style={[
              styles.syncBadge,
              item.synced ? styles.syncBadgeOnline : styles.syncBadgeOffline,
            ]}
          >
            <View
              style={[
                styles.syncDot,
                item.synced ? styles.syncDotOnline : styles.syncDotOffline,
              ]}
            />
            <Text
              style={[
                styles.syncText,
                item.synced ? styles.syncTextOnline : styles.syncTextOffline,
              ]}
            >
              {item.synced ? 'Synced' : 'Queued Offline'}
            </Text>
          </View>
        </View>

        <Text style={styles.coordinates}>
          {formatCoordinates(item.latitude, item.longitude)}
        </Text>

        <View style={styles.bottomRow}>
          <View
            style={[
              styles.distancePill,
              isBaseline ? styles.baselinePill : styles.distancePillActive,
            ]}
          >
            <Text
              style={[
                styles.distancePillText,
                isBaseline ? styles.baselineText : styles.distancePillTextActive,
              ]}
            >
              {isBaseline
                ? '📍 Duty Start Anchor'
                : `+${formatDistance(item.distanceMoved)} moved`}
            </Text>
          </View>

          {item.accuracy !== undefined && (
            <Text style={styles.accuracyText}>
              ±{Math.round(item.accuracy)}m GPS accuracy
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  leftColumn: {
    alignItems: 'center',
    marginRight: 12,
    width: 32,
  },
  pointNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  pointNumberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#334155',
    marginTop: 6,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  syncBadgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  syncBadgeOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncDotOnline: {
    backgroundColor: '#10B981',
  },
  syncDotOffline: {
    backgroundColor: '#F59E0B',
  },
  syncText: {
    fontSize: 10,
    fontWeight: '700',
  },
  syncTextOnline: {
    color: '#34D399',
  },
  syncTextOffline: {
    color: '#FBBF24',
  },
  coordinates: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distancePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distancePillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  baselinePill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  distancePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  distancePillTextActive: {
    color: '#10B981',
  },
  baselineText: {
    color: '#38BDF8',
  },
  accuracyText: {
    fontSize: 11,
    color: '#64748B',
  },
});
