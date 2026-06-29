import { auth, db } from "@/src/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where
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
    TextInput,
    View
} from "react-native";

const COMPANY_ID = "jcf-enterprise";

type AdminPage = "overview" | "employees" | "jobSites" | "timeEntries";

type EmployeeRecord = {
  id: string;
  uid: string;
  email: string;
  companyId: string;
  role?: string;
  approved?: boolean;
  active?: boolean;
  createdAt?: any;
};

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

type JobSite = {
    id: string;
    name: string;
    address?: string;
    companyId: string;
    active: boolean;
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

  const [activeAdminPage, setActiveAdminPage] = useState<AdminPage>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [newJobSiteName, setNewJobSiteName] = useState("");
  const [newJobSiteAddress, setNewJobSiteAddress] = useState("");
  const [savingJobSite, setSavingJobSite] = useState(false);

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
      loadAdminData();
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

  async function loadAdminData() {
    await Promise.all([
      loadAllTimeEntries(),
      loadEmployees(),
      loadJobSites(),
    ]);
  }
  
  async function loadEmployees() {
    try {
      setError("");
  
      const q = query(
        collection(db, "employees"),
        where("companyId", "==", COMPANY_ID)
      );
  
      const snapshot = await getDocs(q);
  
      const loadedEmployees: EmployeeRecord[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<EmployeeRecord, "id">),
      }));
  
      loadedEmployees.sort((a, b) => {
        const aApproved = a.approved === true ? 1 : 0;
        const bApproved = b.approved === true ? 1 : 0;
  
        if (aApproved !== bApproved) return aApproved - bApproved;
  
        return a.email.localeCompare(b.email);
      });
  
      setEmployees(loadedEmployees);
    } catch (err: any) {
      setError(err.message);
    }
  }
  
  async function approveEmployee(employeeId: string) {
    if (!user) return;
  
    try {
      setError("");
  
      await updateDoc(doc(db, "employees", employeeId), {
        approved: true,
        active: true,
        approvedBy: user.uid,
        approvedByEmail: user.email,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  
      await loadEmployees();
    } catch (err: any) {
      setError(err.message);
    }
  }
  
  async function deactivateEmployee(employeeId: string) {
    if (!user) return;
  
    try {
      setError("");
  
      await updateDoc(doc(db, "employees", employeeId), {
        active: false,
        deactivatedBy: user.uid,
        deactivatedByEmail: user.email,
        deactivatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  
      await loadEmployees();
    } catch (err: any) {
      setError(err.message);
    }
  }
  
  async function reactivateEmployee(employeeId: string) {
    if (!user) return;
  
    try {
      setError("");
  
      await updateDoc(doc(db, "employees", employeeId), {
        approved: true,
        active: true,
        reactivatedBy: user.uid,
        reactivatedByEmail: user.email,
        reactivatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  
      await loadEmployees();
    } catch (err: any) {
      setError(err.message);
    }
  }
  
  async function addJobSite() {
    const cleanName = newJobSiteName.trim();
    const cleanAddress = newJobSiteAddress.trim();
  
    if (!cleanName) {
      setError("Job site name is required.");
      return;
    }
  
    try {
      setSavingJobSite(true);
      setError("");
  
      await addDoc(collection(db, "job_sites"), {
        name: cleanName,
        address: cleanAddress || "",
        companyId: COMPANY_ID,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  
      setNewJobSiteName("");
      setNewJobSiteAddress("");
  
      await loadJobSites();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingJobSite(false);
    }
  }
  
  async function deleteJobSite(siteId: string) {
    try {
      setSavingJobSite(true);
      setError("");
  
      await updateDoc(doc(db, "job_sites", siteId), {
        active: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  
      await loadJobSites();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingJobSite(false);
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

  async function loadJobSites() {
    try {
      setError("");
  
      const q = query(
        collection(db, "job_sites"),
        where("companyId", "==", COMPANY_ID),
        where("active", "==", true)
      );
  
      const snapshot = await getDocs(q);
  
      const loadedSites: JobSite[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<JobSite, "id">),
      }));
  
      loadedSites.sort((a, b) => a.name.localeCompare(b.name));
  
      setJobSites(loadedSites);
    } catch (err: any) {
      setError(err.message);
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
    await loadAdminData();
    setRefreshing(false);
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
        <View style={styles.adminHeader}>
  <View>
    <Text style={styles.title}>Admin</Text>
    <Text style={styles.subtitle}>
      {activeAdminPage === "overview" && "Overview"}
      {activeAdminPage === "employees" && "Employee Management"}
      {activeAdminPage === "jobSites" && "Job Sites"}
      {activeAdminPage === "timeEntries" && "Time Entries"}
    </Text>
  </View>

  <Pressable
    style={styles.menuButton}
    onPress={() => setMenuOpen((value) => !value)}
  >
    <Text style={styles.menuIcon}>☰</Text>
  </Pressable>
</View>

{menuOpen && (
  <View style={styles.menuCard}>
    <Pressable
      style={styles.menuItem}
      onPress={() => {
        setActiveAdminPage("overview");
        setMenuOpen(false);
      }}
    >
      <Text style={styles.menuItemText}>Overview</Text>
    </Pressable>

    <Pressable
      style={styles.menuItem}
      onPress={() => {
        setActiveAdminPage("employees");
        setMenuOpen(false);
      }}
    >
      <Text style={styles.menuItemText}>Employees</Text>
    </Pressable>

    <Pressable
      style={styles.menuItem}
      onPress={() => {
        setActiveAdminPage("jobSites");
        setMenuOpen(false);
      }}
    >
      <Text style={styles.menuItemText}>Job Sites</Text>
    </Pressable>

    <Pressable
      style={styles.menuItem}
      onPress={() => {
        setActiveAdminPage("timeEntries");
        setMenuOpen(false);
      }}
    >
      <Text style={styles.menuItemText}>Time Entries</Text>
    </Pressable>
  </View>
)}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {activeAdminPage === "overview" && (
  <>
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>Payroll Hours</Text>
        <Text style={styles.statValue}>{formatMinutes(totalPayrollMinutes)}</Text>
      </View>

      <View style={styles.statCard}>
        <Text style={styles.statLabel}>Employees</Text>
        <Text style={styles.statValue}>{employees.length}</Text>
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
  </>
)}

{activeAdminPage === "employees" && (
  <>
    <Text style={styles.sectionTitle}>Employees</Text>

    {employees.length === 0 ? (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No employees found.</Text>
      </View>
    ) : (
      employees.map((employee) => (
        <View key={employee.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.employeeEmail}>{employee.email}</Text>
              <Text style={styles.normalText}>
                {employee.approved ? "Approved" : "Pending Approval"} •{" "}
                {employee.active ? "Active" : "Inactive"}
              </Text>
            </View>

            <Text
              style={[
                styles.pill,
                employee.approved && employee.active
                  ? styles.pillActive
                  : styles.pillComplete,
              ]}
            >
              {employee.approved && employee.active ? "Active" : "Pending"}
            </Text>
          </View>

          {!employee.approved && (
            <Pressable
              style={styles.addButton}
              onPress={() => approveEmployee(employee.id)}
            >
              <Text style={styles.addButtonText}>Approve Employee</Text>
            </Pressable>
          )}

          {employee.approved && employee.active && (
            <Pressable
              style={styles.deleteButtonFull}
              onPress={() => deactivateEmployee(employee.id)}
            >
              <Text style={styles.deleteButtonText}>Deactivate Employee</Text>
            </Pressable>
          )}

          {employee.approved && !employee.active && (
            <Pressable
              style={styles.addButton}
              onPress={() => reactivateEmployee(employee.id)}
            >
              <Text style={styles.addButtonText}>Reactivate Employee</Text>
            </Pressable>
          )}
        </View>
      ))
    )}
  </>
)}

{activeAdminPage === "jobSites" && (
  <>
    <Text style={styles.sectionTitle}>Job Sites</Text>

    <View style={styles.card}>
      <Text style={styles.label}>New Job Site Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Main Job Site"
        value={newJobSiteName}
        onChangeText={setNewJobSiteName}
      />

      <Text style={styles.label}>Address / Notes</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 123 Main Street"
        value={newJobSiteAddress}
        onChangeText={setNewJobSiteAddress}
      />

      <Pressable
        style={styles.addButton}
        onPress={addJobSite}
        disabled={savingJobSite}
      >
        <Text style={styles.addButtonText}>
          {savingJobSite ? "Saving..." : "Add Job Site"}
        </Text>
      </Pressable>
    </View>

    {jobSites.length === 0 ? (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No active job sites found.</Text>
      </View>
    ) : (
      jobSites.map((site) => (
        <View key={site.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.siteName}>{site.name}</Text>
              <Text style={styles.normalText}>
                {site.address || "No address saved"}
              </Text>
            </View>

            <Pressable
              style={styles.deleteButton}
              onPress={() => deleteJobSite(site.id)}
              disabled={savingJobSite}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))
    )}
  </>
)}

{activeAdminPage === "timeEntries" && (
  <>
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
              isActiveEntry(entry) ? styles.pillActive : styles.pillComplete,
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
  </>
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
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonText: {
    color: "white",
    fontWeight: "800",
  },
  deleteButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "800",
  },
  siteName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  adminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 12,
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    color: "white",
    fontSize: 26,
    fontWeight: "800",
  },
  menuCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    overflow: "hidden",
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  deleteButtonFull: {
    backgroundColor: "#dc2626",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
});