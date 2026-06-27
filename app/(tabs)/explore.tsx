import { auth, db } from "@/src/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

type TimeEntry = {
  id: string;
  jobSiteName?: string;
  status?: string;
  clockInTime?: any;
  clockOutTime?: any;
  createdAt?: any;
};

function formatFirebaseTime(timestamp: any) {
  if (!timestamp) return "Not saved";

  try {
    const date = timestamp.toDate();
    return date.toLocaleString();
  } catch {
    return "Invalid date";
  }
}

function calculateDuration(clockInTime: any, clockOutTime: any) {
  if (!clockInTime || !clockOutTime) return "Active";

  try {
    const start = clockInTime.toDate();
    const end = clockOutTime.toDate();

    const diffMs = end.getTime() - start.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 1000 / 60));

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  } catch {
    return "Unable to calculate";
  }
}

export default function TimesheetsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await loadTimeEntries(currentUser);
      } else {
        setEntries([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function loadTimeEntries(currentUser = user) {
    if (!currentUser) return;

    try {
      const q = query(
        collection(db, "time_entries"),
        where("userId", "==", currentUser.uid)
      );

      const snapshot = await getDocs(q);

      const loadedEntries: TimeEntry[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      loadedEntries.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const bTime = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
        return bTime - aTime;
      });

      setEntries(loadedEntries);
    } catch (error: any) {
      console.log("Failed to load time entries:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadTimeEntries();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading timesheets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Timesheets</Text>
          <Text style={styles.emptyText}>Log in to view your time entries.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.title}>Timesheets</Text>
        <Text style={styles.subtitle}>Your recent time entries</Text>

        <Pressable style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>

        {entries.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No time entries yet.</Text>
          </View>
        ) : (
          entries.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.jobSite}>
                  {entry.jobSiteName ?? "Unknown Job Site"}
                </Text>

                <Text
                  style={[
                    styles.status,
                    entry.status === "clocked_in"
                      ? styles.statusActive
                      : styles.statusComplete,
                  ]}
                >
                  {entry.status === "clocked_in" ? "Active" : "Complete"}
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.label}>Clock In</Text>
              <Text style={styles.value}>
                {formatFirebaseTime(entry.clockInTime)}
              </Text>

              <Text style={styles.label}>Clock Out</Text>
              <Text style={styles.value}>
                {formatFirebaseTime(entry.clockOutTime)}
              </Text>

              <Text style={styles.label}>Total Time</Text>
              <Text style={styles.duration}>
                {calculateDuration(entry.clockInTime, entry.clockOutTime)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 34,
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
  loadingText: {
    marginTop: 12,
    color: "#64748b",
  },
  refreshButton: {
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  refreshButtonText: {
    color: "white",
    fontWeight: "800",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  jobSite: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
    paddingRight: 12,
  },
  status: {
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  statusActive: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusComplete: {
    backgroundColor: "#e2e8f0",
    color: "#334155",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 14,
  },
  label: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    color: "#0f172a",
  },
  duration: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
});