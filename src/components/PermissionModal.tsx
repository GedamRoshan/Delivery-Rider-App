import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

interface PermissionModalProps {
  visible: boolean;
  onGrant: () => void;
  onDismiss: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  visible,
  onGrant,
  onDismiss,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>📍</Text>
          </View>

          <Text style={styles.title}>Background Location Access</Text>

          <Text style={styles.description}>
            Delivery Rider App collects location data while you are{' '}
            <Text style={styles.boldText}>On Duty</Text> to track your delivery
            routes, calculate accurate distance travelled (≥30m intervals), and
            verify drop-offs.
          </Text>

          <View style={styles.highlightBox}>
            <Text style={styles.highlightTitle}>
              {Platform.OS === 'android'
                ? 'Important Android Notice:'
                : 'Important iOS Notice:'}
            </Text>
            <Text style={styles.highlightBody}>
              {Platform.OS === 'android'
                ? 'When prompted, please select "Allow all the time" so location polling continues reliably when the app is minimized or your screen is locked.'
                : 'When prompted, please select "Change to Always Allow" so route tracking continues when the app is in the background.'}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissButtonText}>Later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.grantButton}
              onPress={onGrant}
              activeOpacity={0.8}
            >
              <Text style={styles.grantButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  boldText: {
    color: '#10B981',
    fontWeight: '600',
  },
  highlightBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
    marginBottom: 4,
  },
  highlightBody: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },
  grantButton: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
