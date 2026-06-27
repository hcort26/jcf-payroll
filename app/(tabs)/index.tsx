import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

type ClockStatus = 'clocked_out' | 'clocked_in';

export default function HomeScreen() {
  const [status, setStatus] = useState<ClockStatus>('clocked_out');
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [locationText, setLocationText] = useState<string>('No location saved yet');
  const [loading, setLoading] = useState(false);

  async function getLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      throw new Error('Location permission is required to clock in or out.');
    }

    const location = await Location.getCurrentPositionAsync({});

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  }

  async function handleClockIn() {
    try {
      setLoading(true);

      const location = await getLocation();
      const now = new Date();

      setStatus('clocked_in');
      setClockInTime(now.toLocaleTimeString());
      setClockOutTime(null);

      setLocationText(
        `Lat: ${location.latitude.toFixed(5)}, Long: ${location.longitude.toFixed(
          5
        )}, Accuracy: ${Math.round(location.accuracy ?? 0)}m`
      );

      Alert.alert('Clocked In', 'Your clock-in was saved locally.');
    } catch (error: any) {
      Alert.alert('Clock-in failed', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClockOut() {
    try {
      setLoading(true);

      const location = await getLocation();
      const now = new Date();

      setStatus('clocked_out');
      setClockOutTime(now.toLocaleTimeString());

      setLocationText(
        `Lat: ${location.latitude.toFixed(5)}, Long: ${location.longitude.toFixed(
          5
        )}, Accuracy: ${Math.round(location.accuracy ?? 0)}m`
      );

      Alert.alert('Clocked Out', 'Your clock-out was saved locally.');
    } catch (error: any) {
      Alert.alert('Clock-out failed', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.companyName}>JCF Payroll</Text>
        <Text style={styles.subtitle}>Employee Time Clock</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Current Status</Text>

          <Text
            style={[
              styles.status,
              status === 'clocked_in' ? styles.statusIn : styles.statusOut,
            ]}
          >
            {status === 'clocked_in' ? 'Clocked In' : 'Clocked Out'}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.infoTitle}>Job Site</Text>
          <Text style={styles.infoText}>Main Job Site</Text>

          <Text style={styles.infoTitle}>Clock In Time</Text>
          <Text style={styles.infoText}>{clockInTime ?? 'Not clocked in yet'}</Text>

          <Text style={styles.infoTitle}>Clock Out Time</Text>
          <Text style={styles.infoText}>{clockOutTime ?? 'No clock-out yet'}</Text>

          <Text style={styles.infoTitle}>Last Saved Location</Text>
          <Text style={styles.infoText}>{locationText}</Text>

          {status === 'clocked_out' ? (
            <Pressable
              style={[styles.button, styles.clockInButton]}
              onPress={handleClockIn}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Saving...' : 'Clock In'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.button, styles.clockOutButton]}
              onPress={handleClockOut}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Saving...' : 'Clock Out'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.smallCard}>
          <Text style={styles.smallCardTitle}>Next Features</Text>
          <Text style={styles.bullet}>• Employee login</Text>
          <Text style={styles.bullet}>• Save time entries to Firebase</Text>
          <Text style={styles.bullet}>• Job-site GPS validation</Text>
          <Text style={styles.bullet}>• Admin payroll dashboard</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  companyName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 28,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  label: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  status: {
    fontSize: 32,
    fontWeight: '800',
  },
  statusIn: {
    color: '#16a34a',
  },
  statusOut: {
    color: '#dc2626',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 20,
  },
  infoTitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    color: '#0f172a',
  },
  button: {
    marginTop: 26,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  clockInButton: {
    backgroundColor: '#16a34a',
  },
  clockOutButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  smallCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 18,
  },
  smallCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 15,
    color: '#334155',
    marginTop: 4,
  },
});