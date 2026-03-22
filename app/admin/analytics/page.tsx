"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  TrendingUp,
  Users,
  FileText,
  Download,
  PieChart,
  Activity,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  LogOut,
  BookOpen,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";
import LogoutConfirmationModal from "@/components/ui/LogoutConfirmationModal";

type DocumentAnalytics = {
  document_type: string;
  total_requests: number;
  completed_requests: number;
  pending_requests: number;
  processing_requests: number;
  ready_requests: number;
  request_month: string;
  request_year: string;
};

type StudentAnalytics = {
  total_students: number;
  approved_students: number;
  pending_students: number;
  banned_students: number;
  registration_month: string;
  registration_year: string;
};

type MostRequestedDocument = {
  document_type: string;
  request_count: number;
  percentage: number;
};

export default function AdminAnalytics() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>("");
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  // Analytics data
  const [documentAnalytics, setDocumentAnalytics] = useState<DocumentAnalytics[]>([]);
  const [studentAnalytics, setStudentAnalytics] = useState<StudentAnalytics[]>([]);
  const [mostRequestedDocuments, setMostRequestedDocuments] = useState<MostRequestedDocument[]>([]);

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalRequests: 0,
    totalStudents: 0,
    completionRate: 0,
    approvalRate: 0,
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

      await fetchAnalyticsData();
      setLoading(false);
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchAnalyticsData = async () => {
    try {
      // Fetch document request analytics
      const { data: docData, error: docError } = await supabase
        .from("document_request_analytics")
        .select("*")
        .order("request_year", { ascending: false })
        .order("request_month", { ascending: false })
        .limit(50);

      if (docError) throw docError;
      setDocumentAnalytics(docData as DocumentAnalytics[]);

      // Fetch student registration analytics
      const { data: studentData, error: studentError } = await supabase
        .from("student_registration_analytics")
        .select("*")
        .order("registration_year", { ascending: false })
        .order("registration_month", { ascending: false })
        .limit(50);

      if (studentError) throw studentError;
      setStudentAnalytics(studentData as StudentAnalytics[]);

      // Fetch most requested documents
      const { data: mostRequestedData, error: mostRequestedError } = await supabase
        .from("most_requested_documents")
        .select("*")
        .order("request_count", { ascending: false })
        .limit(10);

      if (mostRequestedError) throw mostRequestedError;
      setMostRequestedDocuments(mostRequestedData as MostRequestedDocument[]);

      // Calculate summary stats
      await calculateSummaryStats();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics data");
    }
  };

  const calculateSummaryStats = async () => {
    try {
      // Get total requests
      const { count: totalRequests, error: requestsError } = await supabase
        .from("requests")
        .select("*", { count: "exact", head: true });

      if (requestsError) throw requestsError;

      // Get total students
      const { count: totalStudents, error: studentsError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");

      if (studentsError) throw studentsError;

      // Get completed requests
      const { count: completedRequests, error: completedError } = await supabase
        .from("requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "Completed");

      if (completedError) throw completedError;

      // Get approved students
      const { count: approvedStudents, error: approvedError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("is_banned", false);

      if (approvedError) throw approvedError;

      const completionRate = totalRequests && totalRequests > 0 ? (completedRequests! / totalRequests) * 100 : 0;
      const approvalRate = totalStudents && totalStudents > 0 ? (approvedStudents! / totalStudents) * 100 : 0;

      setSummaryStats({
        totalRequests: totalRequests || 0,
        totalStudents: totalStudents || 0,
        completionRate: Math.round(completionRate),
        approvalRate: Math.round(approvalRate),
      });
    } catch (err: unknown) {
      console.error("Failed to calculate summary stats:", err);
    }
  };

  const exportAnalytics = () => {
    // Create CSV content
    const csvContent = [
      ["Document Type", "Total Requests", "Completed", "Pending", "Processing", "Ready"],
      ...mostRequestedDocuments.map(doc => [
        doc.document_type,
        doc.request_count,
        doc.percentage + "%"
      ])
    ].map(row => row.join(",")).join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sorsu-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading analytics...</p>
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
                onClick={exportAnalytics}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
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

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900">{summaryStats.totalRequests.toLocaleString()}</p>
              </div>
              <FileText className="h-10 w-10 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{summaryStats.totalStudents.toLocaleString()}</p>
              </div>
              <Users className="h-10 w-10 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">{summaryStats.completionRate}%</p>
              </div>
              <CheckCircle className="h-10 w-10 text-purple-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approval Rate</p>
                <p className="text-3xl font-bold text-gray-900">{summaryStats.approvalRate}%</p>
              </div>
              <TrendingUp className="h-10 w-10 text-orange-500" />
            </div>
          </div>
        </div>

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
              <button 
                onClick={() => router.push("/admin/student-ids")}
                className="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium"
              >
                <BookOpen className="h-5 w-5 inline mr-2" />
                Student ID Management
              </button>
              <button className="px-6 py-3 border-b-2 border-sorsuMaroon text-sorsuMaroon font-medium">
                <PieChart className="h-5 w-5 inline mr-2" />
                Analytics
              </button>
            </nav>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Most Requested Documents */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Most Requested Documents</h2>
              <PieChart className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {mostRequestedDocuments.slice(0, 5).map((doc, index) => (
                <div key={doc.document_type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? "bg-blue-500" :
                      index === 1 ? "bg-green-500" :
                      index === 2 ? "bg-yellow-500" :
                      index === 3 ? "bg-purple-500" :
                      "bg-gray-500"
                    }`}></div>
                    <span className="text-sm font-medium text-gray-900">{doc.document_type}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{doc.request_count}</span>
                    <span className="text-sm text-gray-500 ml-2">({doc.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Student Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Student Activity</h2>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {studentAnalytics.slice(0, 5).map((student, index) => (
                <div key={`${student.registration_month}-${student.registration_year}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(student.registration_month).toLocaleDateString("en-US", { 
                        month: "short", 
                        year: "numeric" 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-blue-500" />
                      <span className="text-gray-600">{student.total_students}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-gray-600">{student.approved_students}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users className="h-5 w-5 text-blue-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Manage Students</p>
                <p className="text-sm text-gray-500">View and manage student accounts</p>
              </div>
            </button>
            <button
              onClick={exportAnalytics}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="h-5 w-5 text-green-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Export Data</p>
                <p className="text-sm text-gray-500">Download analytics as CSV</p>
              </div>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Activity className="h-5 w-5 text-purple-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Refresh Data</p>
                <p className="text-sm text-gray-500">Update analytics data</p>
              </div>
            </button>
          </div>
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document Request Details */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Document Request Analytics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pending
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documentAnalytics.slice(0, 10).map((doc, index) => (
                    <tr key={`${doc.document_type}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {doc.document_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.total_requests}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.completed_requests}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.pending_requests}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Registration Details */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Student Registration Analytics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approved
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pending
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentAnalytics.slice(0, 10).map((student) => (
                    <tr key={`${student.registration_month}-${student.registration_year}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(student.registration_month).toLocaleDateString("en-US", { 
                          month: "short", 
                          year: "numeric" 
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.total_students}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.approved_students}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.pending_students}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutConfirmation}
        onConfirm={confirmSignOut}
        onCancel={() => setShowLogoutConfirmation(false)}
      />
    </div>
  );
}
