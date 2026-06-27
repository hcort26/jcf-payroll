import { auth, db } from "@/src/firebase";
import * as Location from "expo-location";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

type ClockStatus = "clocked_out" | "clocked_in";

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<ClockStatus>("clocked_out");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("No location saved yet");
  const [loading, setLoading] = useState(false);
  const [loadingActiveEntry, setLoadingActiveEntry] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });
  
    return unsubscribe;
  }, []);
  
  useEffect(() => {
    if (user) {
      loadActiveTimeEntry(user);
    } else {
      setStatus("clocked_out");
      setActiveEntryId(null);
      setClockInTime(null);
      setClockOutTime(null);
    }
  }, [user]);

  async function login() {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      Alert.alert("Login failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      Alert.alert("Registration failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveTimeEntry(currentUser: User) {
    try {
      setLoadingActiveEntry(true);
  
      console.log("Checking active entry for:", currentUser.uid);
  
      const q = query(
        collection(db, "time_entries"),
        where("userId", "==", currentUser.uid),
        where("status", "==", "clocked_in")
      );
  
      const snapshot = await getDocs(q);
  
      console.log("Active entries found:", snapshot.size);
  
      if (!snapshot.empty) {
        const activeDoc = snapshot.docs[0];
        const data = activeDoc.data();
  
        setActiveEntryId(activeDoc.id);
        setStatus("clocked_in");
        setClockInTime("Loaded from Firebase");
        setClockOutTime(null);
  
        setLocationText(
          data.clockInLocation
            ? `Loaded active clock-in. Lat: ${data.clockInLocation.latitude?.toFixed?.(5)}, Long: ${data.clockInLocation.longitude?.toFixed?.(5)}`
            : "Active clock-in loaded from Firebase."
        );
  
        return;
      }
  
      setActiveEntryId(null);
      setStatus("clocked_out");
      setClockInTime(null);
      setClockOutTime(null);
    } catch (error: any) {
      console.log("Failed to load active time entry:", error);
      Alert.alert("Load failed", error.message);
    } finally {
      setLoadingActiveEntry(false);
    }
  }
  async function getLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Location permission is required to clock in or out.");
    }

    const location = await Location.getCurrentPositionAsync({});

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  }

  async function handleClockIn() {
    if (!user) return;

    try {
      setLoading(true);

      const location = await getLocation();
      const now = new Date();

      const docRef = await addDoc(collection(db, "time_entries"), {
        userId: user.uid,
        userEmail: user.email,
        companyId: "jcf-demo-company",
        jobSiteId: "main-job-site",
        jobSiteName: "Main Job Site",
        status: "clocked_in",
        clockInTime: serverTimestamp(),
        clockOutTime: null,
        clockInLocation: location,
        clockOutLocation: null,
        approved: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setActiveEntryId(docRef.id);
      setStatus("clocked_in");
      setClockInTime(now.toLocaleTimeString());
      setClockOutTime(null);

      setLocationText(
        `Lat: ${location.latitude.toFixed(5)}, Long: ${location.longitude.toFixed(
          5
        )}, Accuracy: ${Math.round(location.accuracy ?? 0)}m`
      );

      Alert.alert("Clocked In", "Your clock-in was saved to Firebase.");
    } catch (error: any) {
      Alert.alert("Clock-in failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClockOut() {
    if (!user || !activeEntryId) {
      Alert.alert("Error", "No active time entry found.");
      return;
    }

    try {
      setLoading(true);

      const location = await getLocation();
      const now = new Date();

      await updateDoc(doc(db, "time_entries", activeEntryId), {
        status: "clocked_out",
        clockOutTime: serverTimestamp(),
        clockOutLocation: location,
        updatedAt: serverTimestamp(),
      });

      setStatus("clocked_out");
      setActiveEntryId(null);
      setClockOutTime(now.toLocaleTimeString());

      setLocationText(
        `Lat: ${location.latitude.toFixed(5)}, Long: ${location.longitude.toFixed(
          5
        )}, Accuracy: ${Math.round(location.accuracy ?? 0)}m`
      );

      Alert.alert("Clocked Out", "Your clock-out was saved to Firebase.");
    } catch (error: any) {
      Alert.alert("Clock-out failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth || loadingActiveEntry) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loginContainer}>
          <Text style={styles.companyName}>JCF Payroll</Text>
          <Text style={styles.subtitle}>Employee Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable style={styles.primaryButton} onPress={login} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Loading..." : "Log In"}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={register} disabled={loading}>
            <Text style={styles.secondaryText}>Create Test Account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.companyName}>JCF Payroll</Text>
        <Text style={styles.subtitle}>Employee Time Clock</Text>

        <Text style={styles.loggedInText}>Signed in as {user.email}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Current Status</Text>

          <Text
            style={[
              styles.status,
              status === "clocked_in" ? styles.statusIn : styles.statusOut,
            ]}
          >
            {status === "clocked_in" ? "Clocked In" : "Clocked Out"}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.infoTitle}>Job Site</Text>
          <Text style={styles.infoText}>Main Job Site</Text>

          <Text style={styles.infoTitle}>Clock In Time</Text>
          <Text style={styles.infoText}>{clockInTime ?? "Not clocked in yet"}</Text>

          <Text style={styles.infoTitle}>Clock Out Time</Text>
          <Text style={styles.infoText}>{clockOutTime ?? "No clock-out yet"}</Text>

          <Text style={styles.infoTitle}>Last Saved Location</Text>
          <Text style={styles.infoText}>{locationText}</Text>

          {status === "clocked_out" ? (
            <Pressable
              style={[styles.button, styles.clockInButton]}
              onPress={handleClockIn}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Saving..." : "Clock In"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.button, styles.clockOutButton]}
              onPress={handleClockOut}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Saving..." : "Clock Out"}
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.logoutButton} onPress={() => signOut(auth)}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loginContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  companyName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
  },
  loggedInText: {
    textAlign: "center",
    color: "#475569",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: "center",
  },
  secondaryText: {
    color: "#2563eb",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  label: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  status: {
    fontSize: 32,
    fontWeight: "800",
  },
  statusIn: {
    color: "#16a34a",
  },
  statusOut: {
    color: "#dc2626",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 20,
  },
  infoTitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    color: "#0f172a",
  },
  button: {
    marginTop: 26,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
  },
  clockInButton: {
    backgroundColor: "#16a34a",
  },
  clockOutButton: {
    backgroundColor: "#dc2626",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  logoutButton: {
    marginTop: 24,
    alignItems: "center",
  },
  logoutText: {
    color: "#2563eb",
    fontWeight: "700",
  },
});