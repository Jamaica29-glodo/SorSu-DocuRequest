"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Shield,
  Ban,
  Eye,
  Loader2,
  TrendingUp,
  FileText,
  BarChart3,
  LogOut,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";
import LogoutConfirmationModal from "@/components/ui/LogoutConfirmationModal";

type StudentProfile = {
  id: string;
  student_id: string;
  full_name: string;
  email_address: string;
  course_program: string;
  contact_number: string;
  role: string;
  is_approved: boolean;
  is_banned: boolean;
  approval_reason: string | null;
  ban_reason: string | null;
  approved_at: string | null;
  banned_at: string | null;
  created_at: string;
};

type AdminStats = {
  total_students: number;
  pending_approvals: number;
  approved_students: number;
  banned_students: number;
  total_requests: number;
  recent_registrations: number;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [adminName, setAdminName] = useState<string>("");

  // Filters and search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "banned">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Modal states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  // Check admin authentication and fetch data
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      // Get user profile and check admin role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (profileError || !profile || profile.role !== "admin") {
        router.push("/login");
        return;
      }

      setAdminName(profile.full_name || "Admin");

      await fetchStudents();
      await fetchStats();
      setLoading(false);
    };

    void init();
  }, [router]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudents(data as StudentProfile[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch students");
    }
  };

  const fetchStats = async () => {
    try {
      // Get student statistics
      const { data: studentsData, error: studentsError } = await supabase
        .from("profiles")
        .select("is_approved, is_banned, created_at")
        .eq("role", "student");

      if (studentsError) throw studentsError;

      // Get request statistics
      const { count: totalRequests, error: requestsError } = await supabase
        .from("requests")
        .select("*", { count: "exact", head: true });

      if (requestsError) throw requestsError;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const adminStats: AdminStats = {
        total_students: studentsData?.length || 0,
        pending_approvals: studentsData?.filter(s => !s.is_approved).length || 0,
        approved_students: studentsData?.filter(s => s.is_approved && !s.is_banned).length || 0,
        banned_students: studentsData?.filter(s => s.is_banned).length || 0,
        total_requests: totalRequests || 0,
        recent_registrations: studentsData?.filter(s => new Date(s.created_at) > thirtyDaysAgo).length || 0,
      };

      setStats(adminStats);
    } catch (err: unknown) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const handleApproveStudent = async () => {
    if (!selectedStudent) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_approved: true,
          approval_reason: actionReason,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedStudent.id);

      if (error) throw error;

      // TODO: Send approval email
      await sendEmailNotification(selectedStudent.email_address, "approved", actionReason);

      setShowApprovalModal(false);
      setActionReason("");
      setSelectedStudent(null);
      await fetchStudents();
      await fetchStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve student");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanStudent = async () => {
    if (!selectedStudent) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: true,
          ban_reason: actionReason,
          banned_at: new Date().toISOString(),
        })
        .eq("id", selectedStudent.id);

      if (error) throw error;

      // TODO: Send ban email
      await sendEmailNotification(selectedStudent.email_address, "banned", actionReason);

      setShowBanModal(false);
      setActionReason("");
      setSelectedStudent(null);
      await fetchStudents();
      await fetchStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to ban student");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: false,
          ban_reason: null,
          banned_at: null,
        })
        .eq("id", studentId);

      if (error) throw error;

      await fetchStudents();
      await fetchStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to unban student");
    }
  };

  const sendEmailNotification = async (email: string, action: string, reason: string) => {
    try {
      const response = await fetch("/api/send-admin-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          action,
          reason,
          studentName: selectedStudent?.full_name,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send email notification");
      }
    } catch (error) {
      console.error("Error sending email notification:", error);
    }
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Filter students based on search and status
  const filteredStudents = students.filter((student) => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email_address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "pending" && !student.is_approved) ||
      (statusFilter === "approved" && student.is_approved && !student.is_banned) ||
      (statusFilter === "banned" && student.is_banned);

    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-linear-to-r from-sorsuMaroon to-maroon-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/images/sorsu-logo.png"
                alt="SorSU Logo"
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg bg-white p-2"
              />
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-maroon-100">Sorsogon State University - Student Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <Shield className="h-5 w-5" />
                <span className="font-medium">{adminName}</span>
              </div>
              <button
                onClick={() => setShowLogoutConfirmation(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 mb-6">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_students}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending_approvals}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved_students}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Banned</p>
                  <p className="text-2xl font-bold text-red-600">{stats.banned_students}</p>
                </div>
                <UserX className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.total_requests}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">New (30 days)</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.recent_registrations}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-500" />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button className="px-6 py-3 border-b-2 border-sorsuMaroon text-sorsuMaroon font-medium">
                <Users className="h-5 w-5 inline mr-2" />
                Student Management
              </button>
              <button 
                onClick={() => router.push("/admin/student-ids")}
                className="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium"
              >
                <Shield className="h-5 w-5 inline mr-2" />
                Student ID Management
              </button>
              <button 
                onClick={() => router.push("/admin/analytics")}
                className="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium"
              >
                <BarChart3 className="h-5 w-5 inline mr-2" />
                Analytics
              </button>
            </nav>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, student ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "approved" | "banned")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
            >
              <option value="all">All Students</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                        <div className="text-sm text-gray-500">ID: {student.student_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{student.email_address}</div>
                      <div className="text-sm text-gray-500">{student.contact_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{student.course_program || "Not set"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {student.is_banned ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Ban className="h-3 w-3 mr-1" />
                            Banned
                          </span>
                        ) : !student.is_approved ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(student.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowViewModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-900"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {!student.is_approved && !student.is_banned && (
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowApprovalModal(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        {!student.is_banned && (
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowBanModal(true);
                            }}
                            className="text-red-600 hover:text-red-900"
                            title="Ban"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        {student.is_banned && (
                          <button
                            onClick={() => handleUnbanStudent(student.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Unban"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, filteredStudents.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium">{filteredStudents.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? "z-10 bg-sorsuMaroon border-sorsuMaroon text-white"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedStudent && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Approve Student Account</h3>
                  <p className="text-sm text-gray-600">Review and approve this student registration</p>
                </div>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Name:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Email:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.email_address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Student ID:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.student_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Program:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.course_program || "Not set"}</span>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Approval Reason (Optional)
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Enter reason for approval..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleApproveStudent}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Approving...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Approve Student
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedStudent(null);
                    setActionReason("");
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ban Modal */}
      {showBanModal && selectedStudent && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <Ban className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Ban Student Account</h3>
                  <p className="text-sm text-gray-600">This action will restrict student access</p>
                </div>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Name:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Email:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.email_address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Student ID:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.student_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Program:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.course_program || "Not set"}</span>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ban Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  placeholder="Enter reason for banning..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleBanStudent}
                  disabled={actionLoading || !actionReason.trim()}
                  className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Banning...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Ban className="h-4 w-4" />
                      Ban Student
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowBanModal(false);
                    setSelectedStudent(null);
                    setActionReason("");
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedStudent && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto transform transition-all border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <Eye className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Student Details</h3>
                    <p className="text-sm text-gray-600">Complete student information</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedStudent(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-6 border border-white/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Full Name</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedStudent.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Student ID</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedStudent.student_id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Email Address</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedStudent.email_address}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Contact Number</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedStudent.contact_number}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Course Program</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedStudent.course_program || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Account Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedStudent.is_banned ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <Ban className="h-3 w-3 mr-1" />
                          Banned
                        </span>
                      ) : !selectedStudent.is_approved ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending Approval
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approved
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Registration Date</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(selectedStudent.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedStudent.approved_at && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Approved Date</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(selectedStudent.approved_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedStudent.approval_reason && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-500 mb-2">Approval Reason</p>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800">{selectedStudent.approval_reason}</p>
                      </div>
                    </div>
                  )}
                  {selectedStudent.ban_reason && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-500 mb-2">Ban Reason</p>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-600">{selectedStudent.ban_reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutConfirmation}
        onConfirm={confirmSignOut}
        onCancel={() => setShowLogoutConfirmation(false)}
      />
    </div>
  );
}
