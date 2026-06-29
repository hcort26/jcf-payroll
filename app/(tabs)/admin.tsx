import { auth, db } from "@/src/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
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
  userId?: string;
  userEmail?: string;
  jobSiteName?: string;
  status?: string;
  clockInTime?: any;
  clockOutTime?: any;
  createdAt?: any;
};

type EmployeeSummary = {
  email: string;
  totalMinutes: number;
  completedShifts: number;
  activeShifts: number;
};

function formatFirebaseTime(timestamp: any) {
  if (!timestamp) return "Not saved";

  try {
    return timestamp.toDate().toLocaleString();
  } catch {
    return "Invalid date";
  }
}

function getDurationMinutes(clockInTime: any, clockOutTime: any) {
  if (!clockInTime || !clockOutTime) return 0;

  try {
    const start = clockInTime.toDate();
    const end = clockOutTime.toDate();

    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diffMs / 1000 / 60));
  } catch {
    return 0;
  }
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function isThisWeek(timestamp: any) {
  if (!timestamp) return false;

  try {
    const date = timestamp.toDate();
    const now = new Date();

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return date >= startOfWeek && date < endOfWeek;
  } catch {
    return false;
  }
}

function isActiveEntry(entry: TimeEntry) {
    const status = String(entry.status ?? "").trim().toLowerCase();
  
    return (
      status === "clocked_in" ||
      status === "active" ||
      (!!entry.clockInTime && !entry.clockOutTime)
    );
  }

export default function AdminScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showThisWeekOnly, setShowThisWeekOnly] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await checkAdminAccess(currentUser);
      } else {
        setIsAdmin(false);
      }

      setCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
      loadAllTimeEntries();
    }
  }, [user, isAdmin]);

  async function checkAdminAccess(currentUser: User) {
    try {
      const adminRef = doc(db, "admins", currentUser.uid);
      const adminSnap = await getDoc(adminRef);

      if (adminSnap.exists()) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (err: any) {
      setError(err.message);
      setIsAdmin(false);
    }
  }

  async function loadAllTimeEntries() {
    try {
      setLoadingEntries(true);
      setError("");

      const q = query(collection(db, "time_entries"));
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingEntries(false);
      setRefreshing(false);
    }
  }

  async function closeActiveShift(entryId: string) {
    if (!user) return;
  
    try {
      setLoadingEntries(true);
      setError("");
  
      await updateDoc(doc(db, "time_entries", entryId), {
        status: "clocked_out",
        clockOutTime: serverTimestamp(),
        adminClosed: true,
        adminClosedBy: user.uid,
        adminClosedByEmail: user.email,
        adminClosedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  
      await loadAllTimeEntries();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingEntries(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadAllTimeEntries();
  }

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!showThisWeekOnly) return true;
      return isThisWeek(entry.clockInTime);
    });
  }, [entries, showThisWeekOnly]);

  const employeeSummaries = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();

    for (const entry of filteredEntries) {
      const email = entry.userEmail ?? "Unknown Employee";

      if (!map.has(email)) {
        map.set(email, {
          email,
          totalMinutes: 0,
          completedShifts: 0,
          activeShifts: 0,
        });
      }

      const summary = map.get(email)!;

      if (isActiveEntry(entry)) {
        summary.activeShifts += 1;
      } else {
        summary.completedShifts += 1;
        summary.totalMinutes += getDurationMinutes(
          entry.clockInTime,
          entry.clockOutTime
        );
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalMinutes - a.totalMinutes
    );
  }, [filteredEntries]);

  const totalPayrollMinutes = employeeSummaries.reduce(
    (total, employee) => total + employee.totalMinutes,
    0
  );

  const activeClockIns = filteredEntries.filter(
    (entry) => isActiveEntry(entry)
  ).length;

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Checking admin access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.emptyText}>Log in to view the admin dashboard.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.emptyText}>
            Access denied. This account is not an admin.
          </Text>
          <Text style={styles.smallText}>{user.email}</Text>
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
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Owner payroll overview</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleButton,
              showThisWeekOnly && styles.toggleButtonActive,
            ]}
            onPress={() => setShowThisWeekOnly(true)}
          >
            <Text
              style={[
                styles.toggleText,
                showThisWeekOnly && styles.toggleTextActive,
              ]}
            >
              This Week
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toggleButton,
              !showThisWeekOnly && styles.toggleButtonActive,
            ]}
            onPress={() => setShowThisWeekOnly(false)}
          >
            <Text
              style={[
                styles.toggleText,
                !showThisWeekOnly && styles.toggleTextActive,
              ]}
            >
              All Time
            </Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Payroll Hours</Text>
            <Text style={styles.statValue}>{formatMinutes(totalPayrollMinutes)}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Employees</Text>
            <Text style={styles.statValue}>{employeeSummaries.length}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active</Text>
            <Text style={styles.statValue}>{activeClockIns}</Text>
          </View>
        </View>

        <Pressable style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshButtonText}>
            {loadingEntries ? "Loading..." : "Refresh Dashboard"}
          </Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Employee Summary</Text>

        {employeeSummaries.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No employee hours found.</Text>
          </View>
        ) : (
          employeeSummaries.map((employee) => (
            <View key={employee.email} style={styles.card}>
              <Text style={styles.employeeEmail}>{employee.email}</Text>

              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.label}>Total Time</Text>
                  <Text style={styles.value}>
                    {formatMinutes(employee.totalMinutes)}
                  </Text>
                </View>

                <View>
                  <Text style={styles.label}>Completed</Text>
                  <Text style={styles.value}>{employee.completedShifts}</Text>
                </View>

                <View>
                  <Text style={styles.label}>Active</Text>
                  <Text style={styles.value}>{employee.activeShifts}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Recent Time Entries</Text>

        {filteredEntries.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.employeeEmail}>
                {entry.userEmail ?? "Unknown Employee"}
              </Text>

              <Text
                style={[
                  styles.pill,
                  isActiveEntry(entry)
                    ? styles.pillActive
                    : styles.pillComplete,
                ]}
              >
                {isActiveEntry(entry) ? "Active" : "Complete"}
              </Text>
            </View>

            <Text style={styles.label}>Job Site</Text>
            <Text style={styles.normalText}>
              {entry.jobSiteName ?? "Unknown Job Site"}
            </Text>

            <Text style={styles.label}>Clock In</Text>
            <Text style={styles.normalText}>
              {formatFirebaseTime(entry.clockInTime)}
            </Text>

            <Text style={styles.label}>Clock Out</Text>
            <Text style={styles.normalText}>
              {formatFirebaseTime(entry.clockOutTime)}
            </Text>

            <Text style={styles.label}>Total</Text>
            <Text style={styles.durationText}>
              {isActiveEntry(entry)
                ? "Active"
                : formatMinutes(
                    getDurationMinutes(entry.clockInTime, entry.clockOutTime)
                  )}
            </Text>
            {isActiveEntry(entry) && (
            <Pressable
                style={styles.adminActionButton}
                onPress={() => closeActiveShift(entry.id)}
            >
                <Text style={styles.adminActionButtonText}>
                Close Shift Now
                </Text>
            </Pressable>
            )}
          </View>
        ))}
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
    fontSize: 32,
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
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  smallText: {
    color: "#94a3b8",
    marginTop: 8,
  },
  errorText: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "white",
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  toggleText: {
    color: "#334155",
    fontWeight: "800",
  },
  toggleTextActive: {
    color: "white",
  },
  statsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 18,
  },
  statLabel: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "700",
  },
  statValue: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  refreshButton: {
    backgroundColor: "#0f172a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  refreshButtonText: {
    color: "white",
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 10,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  employeeEmail: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
  },
  label: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 2,
  },
  value: {
    fontSize: 18,
    color: "#0f172a",
    fontWeight: "800",
  },
  normalText: {
    color: "#0f172a",
    fontSize: 15,
  },
  durationText: {
    fontSize: 20,
    color: "#0f172a",
    fontWeight: "800",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  pill: {
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  pillActive: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  pillComplete: {
    backgroundColor: "#e2e8f0",
    color: "#334155",
  },
  adminActionButton: {
    backgroundColor: "#dc2626",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  adminActionButtonText: {
    color: "white",
    fontWeight: "800",
  },
});