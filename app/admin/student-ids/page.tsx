"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Shield,
  LogOut,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";
import LogoutConfirmationModal from "@/components/ui/LogoutConfirmationModal";

type StudentID = {
  id: string;
  student_id: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  student_name: string | null;
};

type AdminStats = {
  total_student_ids: number;
  active_student_ids: number;
  inactive_student_ids: number;
  recently_added: number;
};

export default function StudentIDManagement() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentIDs, setStudentIDs] = useState<StudentID[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [adminName, setAdminName] = useState<string>("");
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedStudentID, setSelectedStudentID] = useState<StudentID | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    student_id: "",
    is_active: true,
    student_name: "",
  });

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

      await fetchStudentIDs();
      await fetchStats();
      setLoading(false);
    };

    void init();
  }, [router]);

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const fetchStudentIDs = async () => {
    try {
      const { data, error } = await supabase
        .from("student_ids")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudentIDs(data as StudentID[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch student IDs");
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("student_ids")
        .select("is_active, created_at");

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const adminStats: AdminStats = {
        total_student_ids: data?.length || 0,
        active_student_ids: data?.filter(s => s.is_active).length || 0,
        inactive_student_ids: data?.filter(s => !s.is_active).length || 0,
        recently_added: data?.filter(s => new Date(s.created_at) > thirtyDaysAgo).length || 0,
      };

      setStats(adminStats);
    } catch (err: unknown) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const handleAddStudentID = async () => {
    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("student_ids")
        .insert({
          student_id: formData.student_id.trim(),
          is_active: formData.is_active,
          student_name: formData.student_name.trim() || null,
          created_by: user?.id,
        });

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      await fetchStudentIDs();
      await fetchStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add student ID");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditStudentID = async () => {
    if (!selectedStudentID) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("student_ids")
        .update({
          student_id: formData.student_id.trim(),
          is_active: formData.is_active,
          student_name: formData.student_name.trim() || null,
        })
        .eq("id", selectedStudentID.id);

      if (error) throw error;

      setShowEditModal(false);
      resetForm();
      setSelectedStudentID(null);
      await fetchStudentIDs();
      await fetchStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update student ID");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStudentID = async () => {
    if (!selectedStudentID) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("student_ids")
        .delete()
        .eq("id", selectedStudentID.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setSelectedStudentID(null);
      await fetchStudentIDs();
      await fetchStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete student ID");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (studentID: StudentID) => {
    try {
      const { error } = await supabase
        .from("student_ids")
        .update({ is_active: !studentID.is_active })
        .eq("id", studentID.id);

      if (error) throw error;

      await fetchStudentIDs();
      await fetchStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const resetForm = () => {
    setFormData({
      student_id: "",
      is_active: true,
      student_name: "",
    });
  };

  const openEditModal = (studentID: StudentID) => {
    setSelectedStudentID(studentID);
    setFormData({
      student_id: studentID.student_id,
      is_active: studentID.is_active,
      student_name: studentID.student_name || "",
    });
    setShowEditModal(true);
  };

  // Filter student IDs based on search and status
  const filteredStudentIDs = studentIDs.filter((studentID) => {
    const matchesSearch = 
      studentID.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (studentID.student_name && studentID.student_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && studentID.is_active) ||
      (statusFilter === "inactive" && !studentID.is_active);

    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStudentIDs.length / itemsPerPage);
  const paginatedStudentIDs = filteredStudentIDs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading student ID management...</p>
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
                <h1 className="text-2xl font-bold">Student ID Management</h1>
                <p className="text-maroon-100">Sorsogon State University - Student ID Validation System</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Student IDs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_student_ids}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active IDs</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active_student_ids}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inactive IDs</p>
                  <p className="text-2xl font-bold text-red-600">{stats.inactive_student_ids}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recently Added (30 days)</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.recently_added}</p>
                </div>
                <Plus className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button 
                onClick={() => router.push("/admin/dashboard")}
                className="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium"
              >
                <Users className="h-5 w-5 inline mr-2" />
                Student Management
              </button>
              <button className="px-6 py-3 border-b-2 border-sorsuMaroon text-sorsuMaroon font-medium">
                <Shield className="h-5 w-5 inline mr-2" />
                Student ID Management
              </button>
              <button 
                onClick={() => router.push("/admin/analytics")}
                className="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium"
              >
                <Eye className="h-5 w-5 inline mr-2" />
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
                placeholder="Search by student ID or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
            >
              <option value="all">All IDs</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-sorsuMaroon text-white px-4 py-2 rounded-lg hover:bg-maroon-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Student ID
            </button>
          </div>
        </div>

        {/* Student IDs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedStudentIDs.map((studentID) => (
                  <tr key={studentID.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{studentID.student_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {studentID.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">{studentID.student_name || "No name"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(studentID.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedStudentID(studentID);
                            setShowViewModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-900"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(studentID)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(studentID)}
                          className={studentID.is_active ? "text-orange-600 hover:text-orange-900" : "text-green-600 hover:text-green-900"}
                          title={studentID.is_active ? "Deactivate" : "Activate"}
                        >
                          {studentID.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudentID(studentID);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
                      {Math.min(currentPage * itemsPerPage, filteredStudentIDs.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium">{filteredStudentIDs.length}</span> results
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

      {/* Add Student ID Modal */}
      {showAddModal && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Add New Student ID</h3>
                  <p className="text-sm text-gray-600">Enter the student ID details</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter student ID (e.g., 2021001)"
                    required
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Active (can be used for registration)
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter student full name (e.g., Juan dela Cruz)"
                    required
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleAddStudentID}
                  disabled={actionLoading || !formData.student_id.trim() || !formData.student_name.trim()}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Student ID
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
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

      {/* Edit Student ID Modal */}
      {showEditModal && selectedStudentID && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Edit2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Edit Student ID</h3>
                  <p className="text-sm text-gray-600">Update the student ID details</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter student ID (e.g., 2021001)"
                    required
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Active (can be used for registration)
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter student full name (e.g., Juan dela Cruz)"
                    required
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleEditStudentID}
                  disabled={actionLoading || !formData.student_id.trim() || !formData.student_name.trim()}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Edit2 className="h-4 w-4" />
                      Update Student ID
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                    setSelectedStudentID(null);
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

      {/* View Student ID Modal */}
      {showViewModal && selectedStudentID && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Student ID Details</h3>
                  <p className="text-sm text-gray-600">View student ID information</p>
                </div>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Student ID:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudentID.student_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedStudentID.is_active 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {selectedStudentID.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Created:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(selectedStudentID.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedStudentID.updated_at !== selectedStudentID.created_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Last Updated:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {new Date(selectedStudentID.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-gray-500">Student Name:</span>
                    <span className="text-sm font-semibold text-gray-900 text-right max-w-xs">
                      {selectedStudentID.student_name || "No name provided"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(selectedStudentID);
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedStudentID(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Student ID Modal */}
      {showDeleteModal && selectedStudentID && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Delete Student ID</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Student ID:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudentID.student_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedStudentID.is_active 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {selectedStudentID.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {selectedStudentID.student_name && (
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-gray-500">Student Name:</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-xs">
                        {selectedStudentID.student_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>Warning:</strong> Deleting this student ID will prevent students from using it for registration. This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteStudentID}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete Student ID
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedStudentID(null);
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

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutConfirmation}
        onConfirm={confirmSignOut}
        onCancel={() => setShowLogoutConfirmation(false)}
      />
    </div>
  );
}
