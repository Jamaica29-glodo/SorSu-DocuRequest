"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  LogOut,
  Search,
  FileText,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  Key,
  Copy,
  RefreshCw,
  User,
  ExternalLink,
  TrendingUp,
  Users,
  FileCheck,
  UserCheck,
  Ban,
  Eye,
  Shield,
  BarChart3,
  Plus,
  Edit2,
  Trash2,
  EyeOff,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";
import { encryptAesGcm, uint8ToBase64 } from "@/app/lib/aesGcm";
import LogoutConfirmationModal from "@/components/ui/LogoutConfirmationModal";
import PWAInstall from "@/components/ui/PWAInstall";

type RequestRow = {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  year_level: string | null;
  verification_url: string | null;
  encrypted_file_bucket: string | null;
  encrypted_file_path: string | null;
  original_file_name: string | null;
  decryption_key: string | null;
  profiles: {
    full_name: string;
    email_address: string;
    student_id: string;
    course_program: string | null;
    contact_number: string | null;
  } | null;
};

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

type StudentID = {
  id: string;
  student_id: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
};

type AdminStats = {
  total_students: number;
  pending_approvals: number;
  approved_students: number;
  banned_students: number;
  total_requests: number;
  recent_registrations: number;
  total_student_ids: number;
  active_student_ids: number;
  inactive_student_ids: number;
};

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-amber-200 shadow-sm",
  "On Process": "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border-blue-200 shadow-sm",
  "Ready for Pick-up": "bg-gradient-to-r from-purple-50 to-violet-50 text-purple-800 border-purple-200 shadow-sm",
  Completed: "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800 border-emerald-200 shadow-sm",
  Cancelled: "bg-gradient-to-r from-rose-50 to-red-50 text-rose-800 border-rose-200 shadow-sm",
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  Pending: Clock,
  "On Process": Loader2,
  "Ready for Pick-up": CheckCircle,
  Completed: CheckCircle,
  Cancelled: XCircle,
};

function generatePassphrase(length = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";

  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }

  return out;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function RegistrarDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<RequestRow[]>([]);

  const [selectedRequestId, setSelectedRequestId] = useState("");
  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const [statusToSet, setStatusToSet] = useState("On Process");
  const [cancellationReason, setCancellationReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [statusAfterUpload, setStatusAfterUpload] = useState("Completed");
  const [decryptionKey, setDecryptionKey] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showStats, setShowStats] = useState(true);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  
  // Summary details modal state
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [summaryType, setSummaryType] = useState<string>("");
  const [summaryCurrentPage, setSummaryCurrentPage] = useState(1);
  const [summaryItemsPerPage] = useState(10);
  
  // Admin functionality states
  const [activeTab, setActiveTab] = useState<"requests" | "students" | "student-ids" | "analytics">("requests");
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentIDs, setStudentIDs] = useState<StudentID[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [registrarName, setRegistrarName] = useState<string>("");
  
  // Student management states
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "pending" | "approved" | "banned">("all");
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [studentItemsPerPage] = useState(10);
  
  // Modal states for student management
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  
  // Student ID management states
  const [studentIDSearchTerm, setStudentIDSearchTerm] = useState("");
  const [studentIDStatusFilter, setStudentIDStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [studentIDCurrentPage, setStudentIDCurrentPage] = useState(1);
  const [studentIDItemsPerPage] = useState(10);
  
  // Modal states for student ID management
  const [showAddIDModal, setShowAddIDModal] = useState(false);
  const [showEditIDModal, setShowEditIDModal] = useState(false);
  const [showDeleteIDModal, setShowDeleteIDModal] = useState(false);
  const [showViewIDModal, setShowViewIDModal] = useState(false);
  const [selectedStudentID, setSelectedStudentID] = useState<StudentID | null>(null);
  const [idActionLoading, setIdActionLoading] = useState(false);
  
  // Form states for student ID
  const [idFormData, setIdFormData] = useState({
    student_id: "",
    is_active: true,
    notes: "",
  });

  // State for request selection transition
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousRequestId, setPreviousRequestId] = useState("");

  // Handle request selection with transition
  const handleRequestSelection = useCallback((requestId: string) => {
    if (requestId === selectedRequestId) return;
    
    setIsTransitioning(true);
    setPreviousRequestId(selectedRequestId);
    
    // Small delay for transition effect
    setTimeout(() => {
      setSelectedRequestId(requestId);
      setIsTransitioning(false);
      setPreviousRequestId("");
    }, 150);
  }, [selectedRequestId]);

  // Handle summary card click
  const handleSummaryCardClick = (type: string) => {
    setSummaryType(type);
    setSummaryCurrentPage(1);
    setShowSummaryDetails(true);
  };

  // Get filtered data for summary details
  const getSummaryData = useMemo(() => {
    switch (summaryType) {
      case "total":
        return requests;
      case "pending":
        return requests.filter(r => r.status === "Pending");
      case "processing":
        return requests.filter(r => r.status === "On Process");
      case "ready":
        return requests.filter(r => r.status === "Ready for Pick-up");
      case "completed":
        return requests.filter(r => r.status === "Completed");
      case "total_students":
        return students;
      case "pending_approvals":
        return students.filter(s => !s.is_approved);
      case "student_ids":
        return studentIDs;
      default:
        return [];
    }
  }, [summaryType, requests, students, studentIDs]);

  // Pagination for summary details
  const summaryTotalPages = Math.ceil(getSummaryData.length / summaryItemsPerPage);
  const paginatedSummaryData = getSummaryData.slice(
    (summaryCurrentPage - 1) * summaryItemsPerPage,
    summaryCurrentPage * summaryItemsPerPage
  );

  // Helper function to get correct verification URL
  const getVerificationUrl = (verificationUrl: string | null) => {
    if (!verificationUrl) return undefined;
    
    // If it's already an API route, return as is
    if (verificationUrl.startsWith('/api/identity-verifications/')) {
      return verificationUrl;
    }
    
    // If it's an old storage path, convert to API route
    if (verificationUrl.includes('identity-verifications/') || verificationUrl.includes('documents/')) {
      const path = verificationUrl.replace(/^(identity-verifications|documents)\//, '');
      return `/api/identity-verifications/${path}`;
    }
    
    // Default: treat as API route
    return verificationUrl;
  };

  // Filter requests based on search term and status
  const filteredRequests = useMemo(() => {
    let filtered = requests.filter((r) =>
      r.document_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.profiles?.student_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filterStatus !== "all") {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    
    return filtered;
  }, [requests, searchTerm, filterStatus]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === "Pending").length;
    const processing = requests.filter(r => r.status === "On Process").length;
    const completed = requests.filter(r => r.status === "Completed").length;
    const ready = requests.filter(r => r.status === "Ready for Pick-up").length;
    
    return { total, pending, processing, completed, ready };
  }, [requests]);
  
  // Filter students based on search and status
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = 
        student.full_name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        student.student_id.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        student.email_address.toLowerCase().includes(studentSearchTerm.toLowerCase());

      const matchesStatus = 
        studentStatusFilter === "all" ||
        (studentStatusFilter === "pending" && !student.is_approved) ||
        (studentStatusFilter === "approved" && student.is_approved && !student.is_banned) ||
        (studentStatusFilter === "banned" && student.is_banned);

      return matchesSearch && matchesStatus;
    });
  }, [students, studentSearchTerm, studentStatusFilter]);
  
  // Student pagination
  const studentTotalPages = Math.ceil(filteredStudents.length / studentItemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (studentCurrentPage - 1) * studentItemsPerPage,
    studentCurrentPage * studentItemsPerPage
  );
  
  // Filter student IDs based on search and status
  const filteredStudentIDs = useMemo(() => {
    return studentIDs.filter((studentID) => {
      const matchesSearch = 
        studentID.student_id.toLowerCase().includes(studentIDSearchTerm.toLowerCase()) ||
        (studentID.notes && studentID.notes.toLowerCase().includes(studentIDSearchTerm.toLowerCase()));

      const matchesStatus = 
        studentIDStatusFilter === "all" ||
        (studentIDStatusFilter === "active" && studentID.is_active) ||
        (studentIDStatusFilter === "inactive" && !studentID.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [studentIDs, studentIDSearchTerm, studentIDStatusFilter]);
  
  // Student ID pagination
  const studentIDTotalPages = Math.ceil(filteredStudentIDs.length / studentIDItemsPerPage);
  const paginatedStudentIDs = filteredStudentIDs.slice(
    (studentIDCurrentPage - 1) * studentIDItemsPerPage,
    studentIDCurrentPage * studentIDItemsPerPage
  );

  const fetchRequests = async () => {
    setError(null);

    interface RegistrarViewRow {
      id: string;
      user_id: string;
      document_type: string;
      year_level: string | null;
      verification_url: string | null;
      status: string;
      cancellation_reason: string | null;
      encrypted_file_bucket: string | null;
      encrypted_file_path: string | null;
      original_file_name: string | null;
      original_mime_type: string | null;
      decryption_key: string | null;
      school_id: string;
      full_name: string;
      email_address: string;
      course_program: string | null;
      contact_number: string | null;
      created_at: string;
    }

    const { data, error: reqError } = await supabase
      .from("registrar_requests_view")
      .select("*")
      .order("created_at", { ascending: false });

    if (reqError) {
      setError(reqError.message);
      return;
    }

    const transformedData = (data as RegistrarViewRow[] || []).map((row) => ({
      ...row,
      student_id: row.school_id,
      updated_at: row.created_at,
      profiles: {
        full_name: row.full_name,
        email_address: row.email_address,
        student_id: row.school_id,
        course_program: row.course_program,
        contact_number: row.contact_number,
      },
    }));

    setRequests((transformedData as RequestRow[]) ?? []);
  };
  
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
  
  const fetchAdminStats = async () => {
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
      
      // Get student ID statistics
      const { data: studentIDsData, error: studentIDsError } = await supabase
        .from("student_ids")
        .select("is_active");
        
      if (studentIDsError) throw studentIDsError;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats: AdminStats = {
        total_students: studentsData?.length || 0,
        pending_approvals: studentsData?.filter(s => !s.is_approved).length || 0,
        approved_students: studentsData?.filter(s => s.is_approved && !s.is_banned).length || 0,
        banned_students: studentsData?.filter(s => s.is_banned).length || 0,
        total_requests: totalRequests || 0,
        recent_registrations: studentsData?.filter(s => new Date(s.created_at) > thirtyDaysAgo).length || 0,
        total_student_ids: studentIDsData?.length || 0,
        active_student_ids: studentIDsData?.filter(id => id.is_active).length || 0,
        inactive_student_ids: studentIDsData?.filter(id => !id.is_active).length || 0,
      };

      setAdminStats(stats);
    } catch (err: unknown) {
      console.error("Failed to fetch admin stats:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.role !== "registrar" && profile?.role !== "admin") {
        router.push("/login");
        return;
      }
      
      setRegistrarName(profile.full_name || "Registrar");

      await fetchRequests();
      await fetchStudents();
      await fetchStudentIDs();
      await fetchAdminStats();
      setLoading(false);
    };

    void init();
  }, [router]);

  // Update decryption key when selected request changes
  useEffect(() => {
    if (selectedRequest) {
      setDecryptionKey(selectedRequest.decryption_key || "");
    } else {
      setDecryptionKey("");
    }
  }, [selectedRequest]);

  const handleSignOut = async () => {
    setShowLogoutConfirmation(true);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0] ?? null;
    setFile(nextFile);
  };

  const handleGenerateKey = async () => {
    const newKey = generatePassphrase();
    setDecryptionKey(newKey);
    setSuccessMessage(null);

    if (selectedRequestId) {
      setIsSavingKey(true);
      try {
        const { error: updateError } = await supabase
          .from("requests")
          .update({ decryption_key: newKey })
          .eq("id", selectedRequestId);

        if (updateError) throw updateError;
        
        // Update local state to reflect change immediately
        setRequests(prev => prev.map(r => 
          r.id === selectedRequestId ? { ...r, decryption_key: newKey } : r
        ));
      } catch (err) {
        console.error("Failed to save decryption key:", err);
        setError("Failed to auto-save decryption key.");
      } finally {
        setIsSavingKey(false);
      }
    }
  };

  const handleKeyChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setDecryptionKey(newKey);
    
    // Auto-save key if request is selected
    if (selectedRequestId) {
      try {
        await supabase
          .from("requests")
          .update({ decryption_key: newKey })
          .eq("id", selectedRequestId);
          
        // Update local state
        setRequests(prev => prev.map(r => 
          r.id === selectedRequestId ? { ...r, decryption_key: newKey } : r
        ));
      } catch (err) {
        console.error("Failed to auto-save key:", err);
      }
    }
  };

  const handleCopyKey = async () => {
    if (!decryptionKey) return;
    await navigator.clipboard.writeText(decryptionKey);
    setSuccessMessage("Decryption key copied.");
  };

  const sendEmailNotification = async (to: string, subject: string, html: string) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });
    } catch (e) {
      console.error("Failed to send email", e);
    }
  };

  const handleUpdateStatus = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedRequest) {
      setError("Please select a request.");
      return;
    }

    if (statusToSet === "Cancelled" && !cancellationReason.trim()) {
      setError("Please provide a cancellation reason.");
      return;
    }

    setUpdatingStatus(true);

    try {
      const nextCancellationReason =
        statusToSet === "Cancelled" ? cancellationReason.trim() : null;

      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status: statusToSet,
          cancellation_reason: nextCancellationReason,
        })
        .eq("id", selectedRequest.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const messageBase = `Your request for ${selectedRequest.document_type} is now '${statusToSet}'.`;
      const message = nextCancellationReason
        ? `${messageBase} Reason: ${nextCancellationReason}`
        : messageBase;

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: selectedRequest.user_id,
        message,
      });

      if (notifError) {
        throw new Error(notifError.message);
      }

      setSuccessMessage("Status updated.");

      // Send email notification
      if (selectedRequest.profiles?.email_address) {
        const subject = `Document Request Update: ${selectedRequest.document_type}`;
        const html = `
          <p>Dear ${selectedRequest.profiles.full_name},</p>
          <p>Your request for <strong>${selectedRequest.document_type}</strong> is now <strong>${statusToSet}</strong>.</p>
          ${
            nextCancellationReason
              ? `<p><strong>Reason:</strong> ${nextCancellationReason}</p>`
              : ""
          }
          <p>Please log in to the Student Portal for more details.</p>
        `;
        void sendEmailNotification(selectedRequest.profiles.email_address, subject, html);
      }

      await fetchRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUploadEncryptedDocument = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedRequest) {
      setError("Please select a request.");
      return;
    }

    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    if (!decryptionKey) {
      setError("Please enter or generate a decryption key.");
      return;
    }

    setUploading(true);

    try {
      const fileBytes = await file.arrayBuffer();
      const enc = await encryptAesGcm(fileBytes, decryptionKey);

      const fileNameSafe = sanitizeFileName(file.name);
      const objectPath = `requests/${selectedRequest.id}/${Date.now()}-${fileNameSafe}.enc`;
      const encryptedBlob = new Blob([enc.ciphertext as BlobPart], {
        type: "application/octet-stream",
      });

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(objectPath, encryptedBlob, {
          contentType: "application/octet-stream",
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status: statusAfterUpload,
          encrypted_file_bucket: "documents",
          encrypted_file_path: objectPath,
          encryption_alg: enc.algorithm,
          encryption_iv: uint8ToBase64(enc.iv),
          encryption_salt: uint8ToBase64(enc.salt),
          encryption_iterations: enc.iterations,
          decryption_key: decryptionKey,
          original_file_name: file.name,
          original_mime_type: file.type || null,
          original_size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: selectedRequest.user_id,
        message: "Your requested document is available for download.",
      });

      if (notifError) {
        throw new Error(notifError.message);
      }

      setFile(null);
      setSuccessMessage("Encrypted document uploaded successfully.");

      // Send email notification
      if (selectedRequest.profiles?.email_address) {
        const subject = `Document Available: ${selectedRequest.document_type}`;
        const html = `
          <p>Dear ${selectedRequest.profiles.full_name},</p>
          <p>Your requested document <strong>${selectedRequest.document_type}</strong> has been uploaded and is ready for download.</p>
          <p>Please log in to the Student Portal to access it.</p>
        `;
        void sendEmailNotification(selectedRequest.profiles.email_address, subject, html);
      }

      await fetchRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Student management handlers
  const handleApproveStudent = async () => {
    if (!selectedStudent) return;
    
    setActionLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_approved: true,
          approval_reason: actionReason.trim() || null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedStudent.id);

      if (error) throw error;

      setSuccessMessage("Student approved successfully.");
      setShowApprovalModal(false);
      setSelectedStudent(null);
      setActionReason("");
      
      await fetchStudents();
      await fetchAdminStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve student.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanStudent = async () => {
    if (!selectedStudent) return;
    
    if (!actionReason.trim()) {
      setError("Ban reason is required.");
      return;
    }
    
    setActionLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: true,
          is_approved: false,
          ban_reason: actionReason.trim(),
          banned_at: new Date().toISOString(),
        })
        .eq("id", selectedStudent.id);

      if (error) throw error;

      setSuccessMessage("Student banned successfully.");
      setShowBanModal(false);
      setSelectedStudent(null);
      setActionReason("");
      
      await fetchStudents();
      await fetchAdminStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to ban student.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to unban this student?")) return;
    
    setActionLoading(true);
    setError(null);
    
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

      setSuccessMessage("Student unbanned successfully.");
      
      await fetchStudents();
      await fetchAdminStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to unban student.");
    } finally {
      setActionLoading(false);
    }
  };

  // Student ID management handlers
  const handleAddStudentID = async () => {
    if (!idFormData.student_id.trim()) {
      setError("Student ID is required.");
      return;
    }
    
    setIdActionLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from("student_ids")
        .insert({
          student_id: idFormData.student_id.trim(),
          is_active: idFormData.is_active,
          notes: idFormData.notes.trim() || null,
        });

      if (error) throw error;

      setSuccessMessage("Student ID added successfully.");
      setShowAddIDModal(false);
      setIdFormData({
        student_id: "",
        is_active: true,
        notes: "",
      });
      
      await fetchStudentIDs();
      await fetchAdminStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add student ID.");
    } finally {
      setIdActionLoading(false);
    }
  };

  const handleEditStudentID = async () => {
    if (!selectedStudentID || !idFormData.student_id.trim()) {
      setError("Student ID is required.");
      return;
    }
    
    setIdActionLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from("student_ids")
        .update({
          student_id: idFormData.student_id.trim(),
          is_active: idFormData.is_active,
          notes: idFormData.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedStudentID.id);

      if (error) throw error;

      setSuccessMessage("Student ID updated successfully.");
      setShowEditIDModal(false);
      setSelectedStudentID(null);
      setIdFormData({
        student_id: "",
        is_active: true,
        notes: "",
      });
      
      await fetchStudentIDs();
      await fetchAdminStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update student ID.");
    } finally {
      setIdActionLoading(false);
    }
  };

  const handleDeleteStudentID = async () => {
    if (!selectedStudentID) return;
    
    if (!confirm("Are you sure you want to delete this student ID? This action cannot be undone.")) return;
    
    setIdActionLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from("student_ids")
        .delete()
        .eq("id", selectedStudentID.id);

      if (error) throw error;

      setSuccessMessage("Student ID deleted successfully.");
      setShowDeleteIDModal(false);
      setSelectedStudentID(null);
      
      await fetchStudentIDs();
      await fetchAdminStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete student ID.");
    } finally {
      setIdActionLoading(false);
    }
  };

  const handleToggleStudentIDStatus = async (studentID: StudentID) => {
    setIdActionLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from("student_ids")
        .update({
          is_active: !studentID.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", studentID.id);

      if (error) throw error;

      setSuccessMessage(`Student ID ${studentID.is_active ? 'deactivated' : 'activated'} successfully.`);
      
      await fetchStudentIDs();
      await fetchAdminStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update student ID status.");
    } finally {
      setIdActionLoading(false);
    }
  };

  const StatusIcon = selectedRequest ? STATUS_ICONS[selectedRequest.status] || AlertCircle : AlertCircle;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/30 flex flex-col transition-all duration-500">
      {/* Enhanced Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-4 py-3 md:px-6 md:py-4 sticky top-0 z-30 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative h-10 w-10 md:h-12 md:w-12 overflow-hidden rounded-xl shadow-lg ring-2 ring-sorsuMaroon/10">
              <Image 
                src="/images/sorsu-logo.png" 
                alt="SorSU Logo" 
                fill
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-sorsuMaroon bg-clip-text text-transparent font-playfair">Registrar Portal</h1>
              <p className="text-xs text-gray-500 hidden md:block font-inter">Document & Student Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">{registrarName}</span>
            </div>
            <PWAInstall />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white/80 backdrop-blur px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-sorsuMaroon hover:border-sorsuMaroon/20 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Navigation Tabs */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-4 py-2 sticky top-16 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto w-full">
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "requests"
                  ? "bg-sorsuMaroon text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Document Requests</span>
              <span className="sm:hidden">Requests</span>
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "students"
                  ? "bg-sorsuMaroon text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Student Management</span>
              <span className="sm:hidden">Students</span>
            </button>
            <button
              onClick={() => setActiveTab("student-ids")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "student-ids"
                  ? "bg-sorsuMaroon text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Student IDs</span>
              <span className="sm:hidden">IDs</span>
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "analytics"
                  ? "bg-sorsuMaroon text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Stats</span>
            </button>
          </nav>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full">
        {loading ? (
          <div className="flex h-full w-full flex-col items-center justify-center p-10">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-sorsuMaroon" />
              <div className="absolute inset-0 h-12 w-12 animate-ping bg-sorsuMaroon/20 rounded-full"></div>
            </div>
            <p className="mt-6 text-sm font-medium text-gray-600 animate-pulse">Loading dashboard...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Overview Statistics Section */}
            {showStats && (
              <div className="px-4 py-6 bg-gradient-to-r from-sorsuMaroon/5 to-transparent border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 font-inter">
                    <TrendingUp className="h-4 w-4 text-sorsuMaroon" />
                    Overview Statistics
                  </h2>
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors font-inter"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-8 gap-3">
                  {/* Document Request Stats */}
                  <div 
                    className="bg-white/70 backdrop-blur rounded-xl p-3 border border-gray-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                    onClick={() => handleSummaryCardClick("total")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Total Requests</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  <div 
                    className="bg-white/70 backdrop-blur rounded-xl p-3 border border-amber-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                    onClick={() => handleSummaryCardClick("pending")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Pending</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                    </div>
                  </div>
                  <div 
                    className="bg-white/70 backdrop-blur rounded-xl p-3 border border-blue-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                    onClick={() => handleSummaryCardClick("processing")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-700">{stats.processing}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Processing</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  <div 
                    className="bg-white/70 backdrop-blur rounded-xl p-3 border border-purple-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                    onClick={() => handleSummaryCardClick("ready")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-purple-700">{stats.ready}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Ready</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <FileCheck className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                  </div>
                  <div 
                    className="bg-white/70 backdrop-blur rounded-xl p-3 border border-emerald-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                    onClick={() => handleSummaryCardClick("completed")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Completed</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Admin Stats */}
                  {adminStats && (
                    <>
                      <div 
                        className="bg-white/70 backdrop-blur rounded-xl p-3 border border-indigo-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                        onClick={() => handleSummaryCardClick("total_students")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-indigo-700">{adminStats.total_students}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Total Students</p>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Users className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                      </div>
                      <div 
                        className="bg-white/70 backdrop-blur rounded-xl p-3 border border-yellow-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                        onClick={() => handleSummaryCardClick("pending_approvals")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-yellow-700">{adminStats.pending_approvals}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Pending Approval</p>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                          </div>
                        </div>
                      </div>
                      <div 
                        className="bg-white/70 backdrop-blur rounded-xl p-3 border border-teal-200/50 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
                        onClick={() => handleSummaryCardClick("student_ids")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-teal-700">{adminStats.total_student_ids}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-inter">Student IDs</p>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-teal-600" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Show Statistics Button (when stats are hidden) */}
            {!showStats && (
              <div className="px-4 py-3 bg-gradient-to-r from-sorsuMaroon/5 to-transparent border-b border-gray-100">
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => setShowStats(true)}
                    className="text-xs text-sorsuMaroon hover:text-sorsuMaroon/80 transition-colors font-inter flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-sorsuMaroon/10"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Show Overview Statistics
                  </button>
                </div>
              </div>
            )}
            
            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "requests" && (
                <div className="p-6 h-full">
                  <div className="bg-white rounded-lg shadow h-full">
                    {/* Header with filters */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <h2 className="text-lg font-semibold text-gray-900 font-playfair">Student Document Requests</h2>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search requests..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck="false"
                              name="search-requests-field"
                              data-form-type="other"
                              data-lp-ignore="true"
                              data-1p-ignore="true"
                              data-bwignore="true"
                              data-kwimpalastatus="ignore"
                              formNoValidate
                              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent w-full sm:w-64"
                            />
                          </div>
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
                          >
                            <option value="all">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="On Process">On Process</option>
                            <option value="Ready for Pick-up">Ready for Pick-up</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    {/* Main Content - Split Layout */}
                    <div className="flex flex-col lg:flex-row h-[calc(100vh-280px)]">
                      {/* Left Side - Request Details Panel (Expanded) */}
                      <div className="flex-1 lg:border-r border-gray-200">
                        <div className="relative h-full">
                          {selectedRequest && !isTransitioning ? (
                            <div className="p-6 h-full overflow-y-auto animate-fadeIn">
                              <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-900 font-playfair">Request Details</h3>
                                <button
                                  onClick={() => setSelectedRequestId("")}
                                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <XCircle className="h-5 w-5" />
                                </button>
                              </div>
                              
                              {/* Student Information Card */}
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-6 transform transition-all duration-300 ease-in-out hover:shadow-lg">
                                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase font-playfair">
                                  <User className="h-5 w-5 text-blue-600" />
                                  Student Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Full Name</p>
                                    <p className="font-semibold text-gray-900">{selectedRequest.profiles?.full_name || "N/A"}</p>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Student ID</p>
                                    <p className="font-semibold text-gray-900">{selectedRequest.profiles?.student_id || "N/A"}</p>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Email Address</p>
                                    <p className="font-semibold text-gray-900">{selectedRequest.profiles?.email_address || "N/A"}</p>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Contact Number</p>
                                    <p className="font-semibold text-gray-900">{selectedRequest.profiles?.contact_number || "N/A"}</p>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 md:col-span-2 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Course Program</p>
                                    <p className="font-semibold text-gray-900">{selectedRequest.profiles?.course_program || "N/A"}</p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Request Information Card */}
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 mb-6 transform transition-all duration-300 ease-in-out hover:shadow-lg">
                                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase font-playfair">
                                  <FileText className="h-5 w-5 text-green-600" />
                                  Request Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Request ID</p>
                                    <p className="font-semibold text-gray-900">#{selectedRequest.id.slice(-8)}</p>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Document Type</p>
                                    <p className="font-semibold text-gray-900">{selectedRequest.document_type}</p>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Year Level</p>
                                    <p className="font-semibold text-gray-900">{selectedRequest.year_level || "N/A"}</p>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1">Status</p>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[selectedRequest.status]} transform transition-all duration-200 hover:scale-105`}>
                                      <StatusIcon className="h-4 w-4 mr-1" />
                                      {selectedRequest.status}
                                    </span>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-4 md:col-span-2 transform transition-all duration-200 hover:scale-105">
                                    <p className="text-sm text-gray-500 mb-1 font-inter">Date Requested</p>
                                    <p className="font-semibold text-gray-900">{new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Identity Verification Section */}
                              {getVerificationUrl(selectedRequest.verification_url) && (
                                <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200 mb-6 transform transition-all duration-300 ease-in-out hover:shadow-lg animate-slideDown">
                                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase font-playfair">
                                    <Shield className="h-5 w-5 text-purple-600" />
                                    Identity Verification
                                  </h4>
                                  <div className="bg-white/70 rounded-lg p-4">
                                    <p className="text-sm text-gray-500 mb-3 font-inter">Verification Document</p>
                                    <a
                                      href={getVerificationUrl(selectedRequest.verification_url)!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium bg-blue-100 px-4 py-2 rounded-lg hover:bg-blue-200 transition-all duration-200 transform hover:scale-105"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      View Verification Document
                                    </a>
                                  </div>
                                </div>
                              )}
                              
                              {/* Action Buttons */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slideUp">
                                {/* Status Update Form */}
                                <form onSubmit={handleUpdateStatus} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm transform transition-all duration-300 ease-in-out hover:shadow-lg">
                                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase font-playfair">
                                    <RefreshCw className="h-5 w-5 text-red-500" />
                                    Update Status
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2 font-inter">
                                        New Status
                                      </label>
                                      <select
                                        value={statusToSet}
                                        onChange={(e) => setStatusToSet(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-all duration-200"
                                      >
                                        <option value="Pending">Pending</option>
                                        <option value="On Process">On Process</option>
                                        <option value="Ready for Pick-up">Ready for Pick-up</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                      </select>
                                    </div>
                                    
                                    {statusToSet === "Cancelled" && (
                                      <div className="animate-fadeIn">
                                        <label className="block text-sm font-medium text-gray-700 mb-2 font-inter">
                                          Cancellation Reason
                                        </label>
                                        <input
                                          type="text"
                                          value={cancellationReason}
                                          onChange={(e) => setCancellationReason(e.target.value)}
                                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-all duration-200"
                                          placeholder="Enter cancellation reason..."
                                          required
                                          autoComplete="off"
                                          autoCorrect="off"
                                          autoCapitalize="off"
                                          spellCheck="false"
                                          name="cancellation-reason-field"
                                          data-form-type="other"
                                          data-lp-ignore="true"
                                          data-1p-ignore="true"
                                          data-bwignore="true"
                                          data-kwimpalastatus="ignore"
                                          formNoValidate
                                        />
                                      </div>
                                    )}
                                  </div>
                                  
                                  <button
                                    type="submit"
                                    disabled={updatingStatus}
                                    className="w-full bg-black text-white px-6 py-3 rounded-lg hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] font-medium"
                                  >
                                    {updatingStatus ? (
                                      <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Updating Status...</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-4 w-4 text-red-500" />
                                        <span>Update Status</span>
                                      </div>
                                    )}
                                  </button>
                                </form>
                                
                                {/* Document Upload Form */}
                                <form onSubmit={handleUploadEncryptedDocument} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm transform transition-all duration-300 ease-in-out hover:shadow-lg">
                                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase font-playfair">
                                    <Shield className="h-5 w-5 text-red-500" />
                                    Secure Upload
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2 font-inter">
                                        Select File
                                      </label>
                                      <input
                                        type="file"
                                        onChange={handleFileChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-all duration-200"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2 font-inter">
                                        Status After Upload
                                      </label>
                                      <select
                                        value={statusAfterUpload}
                                        onChange={(e) => setStatusAfterUpload(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-all duration-200"
                                      >
                                        <option value="Ready for Pick-up">Ready for Pick-up</option>
                                        <option value="Completed">Completed</option>
                                      </select>
                                    </div>
                                  </div>
                                  
                                  <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Decryption Key
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={decryptionKey}
                                        onChange={handleKeyChange}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-all duration-200"
                                        placeholder="Enter or generate decryption key..."
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                        name="decryption-key-field"
                                        data-form-type="password"
                                        data-lp-ignore="true"
                                        data-1p-ignore="true"
                                        data-bwignore="true"
                                        data-kwimpalastatus="ignore"
                                        formNoValidate
                                      />
                                      <button
                                        type="button"
                                        onClick={handleGenerateKey}
                                        disabled={isSavingKey}
                                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all duration-200 transform hover:scale-105 font-medium"
                                      >
                                        <Key className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCopyKey}
                                        disabled={!decryptionKey}
                                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all duration-200 transform hover:scale-105 font-medium"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <button
                                    type="submit"
                                    disabled={uploading}
                                    className="w-full bg-sorsuMaroon text-white px-6 py-3 rounded-lg hover:bg-sorsuMaroon/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] font-medium"
                                  >
                                    {uploading ? (
                                      <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Uploading Document...</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-2">
                                        <Upload className="h-4 w-4" />
                                        <span>Encrypt & Upload</span>
                                      </div>
                                    )}
                                  </button>
                                </form>
                                
                                {/* Secure Document Upload Notification */}
                                {selectedRequest.status === "Completed" && selectedRequest.encrypted_file_bucket && selectedRequest.encrypted_file_path && selectedRequest.original_file_name && (
                                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6 animate-slideUp">
                                    <div className="flex items-start gap-3">
                                      <FileCheck className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1">
                                        <h5 className="font-bold text-green-900 mb-2 font-playfair">SECURE DOCUMENT UPLOADED</h5>
                                        <div className="space-y-1 text-sm text-green-800">
                                          <p><span className="font-semibold">Date:</span> {selectedRequest.updated_at ? new Date(selectedRequest.updated_at).toLocaleDateString() : new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                                          <p><span className="font-semibold">File:</span> {selectedRequest.original_file_name}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : isTransitioning ? (
                            <div className="flex items-center justify-center h-full p-6">
                              <div className="text-center">
                                <Loader2 className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
                                <p className="text-sm text-gray-500 font-inter">Loading request details...</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full p-6 animate-fadeIn">
                              <div className="text-center">
                                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-lg font-medium text-gray-900 mb-2 font-inter">Select a Request</p>
                                <p className="text-sm text-gray-500 font-inter">Choose a document request from the list to view details</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right Side - Request List */}
                      <div className="w-full lg:w-96 lg:min-w-96">
                        <div className="p-4 border-b border-gray-200">
                          <h3 className="font-semibold text-gray-900 font-playfair">Request List</h3>
                          <p className="text-sm text-gray-500 font-inter">{filteredRequests.length} requests</p>
                        </div>
                        
                        <div className="overflow-y-auto h-[calc(100vh-380px)] custom-scrollbar">
                          {filteredRequests.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                              <p className="text-lg font-medium text-gray-900 mb-2 font-inter">No document requests found</p>
                              <p className="text-sm text-gray-500 font-inter">
                                {searchTerm || filterStatus !== "all" 
                                  ? "Try adjusting your search or filter criteria" 
                                  : "No student document requests have been submitted yet"}
                              </p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-200">
                              {filteredRequests.map((request) => (
                                <div
                                  key={request.id}
                                  className={`request-item p-4 cursor-pointer transition-all ${
                                    selectedRequestId === request.id 
                                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                                      : ''
                                  }`}
                                  onClick={() => handleRequestSelection(request.id)}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900 mb-1">
                                        #{request.id.slice(-8)}
                                      </p>
                                      <p className="text-sm text-gray-900 font-medium">
                                        {request.profiles?.full_name || "Unknown"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        ID: {request.profiles?.student_id || "N/A"}
                                      </p>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status] || STATUS_COLORS.Pending} transform transition-all duration-200 hover:scale-105`}>
                                      <StatusIcon className="h-3 w-3 mr-1" />
                                      {request.status}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-gray-900">{request.document_type}</p>
                                      {request.year_level && (
                                        <p className="text-xs text-gray-500">Year {request.year_level}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {getVerificationUrl(request.verification_url) && (
                                        <a
                                          href={getVerificationUrl(request.verification_url)!}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-all duration-200 transform hover:scale-110"
                                          title="View Verification"
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRequestSelection(request.id);
                                        }}
                                        className={`${
                                          selectedRequestId === request.id 
                                            ? "text-blue-600 bg-blue-50" 
                                            : "text-gray-600 hover:text-gray-900"
                                        } p-1 rounded transition-all duration-200 transform hover:scale-110`}
                                        title="View Details"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <p className="text-xs text-gray-500 mt-2">
                                    {new Date(request.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "students" && (
                <div className="p-6">
                  <div className="bg-white rounded-lg shadow">
                    {/* Header with Add Student Button */}
                    <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900 font-playfair">Student Management</h2>
                      <button
                        onClick={() => {
                          setSelectedStudent(null);
                          setActionReason("");
                          setShowApprovalModal(true);
                        }}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Approve Student</span>
                      </button>
                    </div>
                    
                    {/* Search and Filters */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search by name, student ID, or email..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            name="search-students-field"
                            data-form-type="other"
                            data-lp-ignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-kwimpalastatus="ignore"
                            formNoValidate
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
                          />
                        </div>
                        <select
                          value={studentStatusFilter}
                          onChange={(e) => setStudentStatusFilter(e.target.value as "all" | "pending" | "approved" | "banned")}
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
                                      <UserCheck className="h-3 w-3 mr-1" />
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
                                    <>
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
                                    </>
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
                    {studentTotalPages > 1 && (
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                          <button
                            onClick={() => setStudentCurrentPage(Math.max(1, studentCurrentPage - 1))}
                            disabled={studentCurrentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setStudentCurrentPage(Math.min(studentTotalPages, studentCurrentPage + 1))}
                            disabled={studentCurrentPage === studentTotalPages}
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
                                {(studentCurrentPage - 1) * studentItemsPerPage + 1}
                              </span>{" "}
                              to{" "}
                              <span className="font-medium">
                                {Math.min(studentCurrentPage * studentItemsPerPage, filteredStudents.length)}
                              </span>{" "}
                              of{" "}
                              <span className="font-medium">{filteredStudents.length}</span> results
                            </p>
                          </div>
                          <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                              <button
                                onClick={() => setStudentCurrentPage(Math.max(1, studentCurrentPage - 1))}
                                disabled={studentCurrentPage === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                              >
                                Previous
                              </button>
                              {Array.from({ length: studentTotalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                  key={page}
                                  onClick={() => setStudentCurrentPage(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    studentCurrentPage === page
                                      ? "z-10 bg-sorsuMaroon border-sorsuMaroon text-white"
                                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                              <button
                                onClick={() => setStudentCurrentPage(Math.min(studentTotalPages, studentCurrentPage + 1))}
                                disabled={studentCurrentPage === studentTotalPages}
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
              )}
              
              {activeTab === "student-ids" && (
                <div className="p-6">
                  <div className="bg-white rounded-lg shadow">
                    {/* Header with Add Student ID Button */}
                    <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900 font-playfair">Student ID Management</h2>
                      <button
                        onClick={() => {
                          setIdFormData({
                            student_id: "",
                            is_active: true,
                            notes: "",
                          });
                          setShowAddIDModal(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Student ID</span>
                      </button>
                    </div>
                    
                    {/* Search and Filters */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search by student ID or name..."
                            value={studentIDSearchTerm}
                            onChange={(e) => setStudentIDSearchTerm(e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            name="search-student-ids-field"
                            data-form-type="other"
                            data-lp-ignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-kwimpalastatus="ignore"
                            formNoValidate
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
                          />
                        </div>
                        <select
                          value={studentIDStatusFilter}
                          onChange={(e) => setStudentIDStatusFilter(e.target.value as "all" | "active" | "inactive")}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent"
                        >
                          <option value="all">All IDs</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Student IDs Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Student ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Student Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
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
                                <div className="text-sm text-gray-900">{studentID.notes || "Not specified"}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {studentID.is_active ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Active
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(studentID.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedStudentID(studentID);
                                      setShowViewIDModal(true);
                                    }}
                                    className="text-gray-600 hover:text-gray-900"
                                    title="View Details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedStudentID(studentID);
                                      setIdFormData({
                                        student_id: studentID.student_id,
                                        is_active: studentID.is_active,
                                        notes: studentID.notes || "",
                                      });
                                      setShowEditIDModal(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Edit"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleStudentIDStatus(studentID)}
                                    className={studentID.is_active ? "text-yellow-600 hover:text-yellow-900" : "text-green-600 hover:text-green-900"}
                                    title={studentID.is_active ? "Deactivate" : "Activate"}
                                  >
                                    {studentID.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedStudentID(studentID);
                                      setShowDeleteIDModal(true);
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
                    {studentIDTotalPages > 1 && (
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                          <button
                            onClick={() => setStudentIDCurrentPage(Math.max(1, studentIDCurrentPage - 1))}
                            disabled={studentIDCurrentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setStudentIDCurrentPage(Math.min(studentIDTotalPages, studentIDCurrentPage + 1))}
                            disabled={studentIDCurrentPage === studentIDTotalPages}
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
                                {(studentIDCurrentPage - 1) * studentIDItemsPerPage + 1}
                              </span>{" "}
                              to{" "}
                              <span className="font-medium">
                                {Math.min(studentIDCurrentPage * studentIDItemsPerPage, filteredStudentIDs.length)}
                              </span>{" "}
                              of{" "}
                              <span className="font-medium">{filteredStudentIDs.length}</span> results
                            </p>
                          </div>
                          <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                              <button
                                onClick={() => setStudentIDCurrentPage(Math.max(1, studentIDCurrentPage - 1))}
                                disabled={studentIDCurrentPage === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                              >
                                Previous
                              </button>
                              {Array.from({ length: studentIDTotalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                  key={page}
                                  onClick={() => setStudentIDCurrentPage(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    studentIDCurrentPage === page
                                      ? "z-10 bg-sorsuMaroon border-sorsuMaroon text-white"
                                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                              <button
                                onClick={() => setStudentIDCurrentPage(Math.min(studentIDTotalPages, studentIDCurrentPage + 1))}
                                disabled={studentIDCurrentPage === studentIDTotalPages}
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
              )}
              
              {activeTab === "analytics" && (
                <div className="p-6">
                  <div className="bg-white rounded-lg shadow">
                    <h2 className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-200">Analytics</h2>
                    <div className="p-6 text-center text-gray-500">
                      Analytics functionality will be implemented here.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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
                      <span>Approving...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      <span>Approve Student</span>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  placeholder="Enter reason for ban..."
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleBanStudent}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Banning...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Ban className="h-4 w-4" />
                      <span>Ban Student</span>
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

      {/* View Student Modal */}
      {showViewModal && selectedStudent && (
        <>
          {/* Backdrop with blur effect */}
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Student Details</h3>
                  <p className="text-sm text-gray-600">View complete student information</p>
                </div>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Full Name:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Email Address:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.email_address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Student ID:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.student_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Contact Number:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.contact_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Course Program:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudent.course_program || "Not set"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Account Status:</span>
                    <span className="text-sm font-semibold">
                      {selectedStudent.is_banned ? (
                        <span className="text-red-600">Banned</span>
                      ) : !selectedStudent.is_approved ? (
                        <span className="text-yellow-600">Pending Approval</span>
                      ) : (
                        <span className="text-green-600">Approved</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Registration Date:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(selectedStudent.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedStudent.approval_reason && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Approval Reason:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedStudent.approval_reason}</span>
                    </div>
                  )}
                  {selectedStudent.ban_reason && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Ban Reason:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedStudent.ban_reason}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedStudent(null);
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Student ID Modal */}
      {showAddIDModal && (
        <>
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Add Student ID</h3>
                  <p className="text-sm text-gray-600">Add a new student ID to the system</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={idFormData.student_id}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, student_id: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter student ID..."
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    name="add-student-id-field"
                    data-form-type="other"
                    data-lp-ignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-kwimpalastatus="ignore"
                    formNoValidate
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={idFormData.notes}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter student name..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    name="add-student-name-field"
                    data-form-type="other"
                    data-lp-ignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-kwimpalastatus="ignore"
                    formNoValidate
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={idFormData.is_active}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Active (students can use this ID for registration)
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleAddStudentID}
                  disabled={idActionLoading}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {idActionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Adding...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Plus className="h-4 w-4" />
                      <span>Add Student ID</span>
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAddIDModal(false);
                    setIdFormData({
                      student_id: "",
                      is_active: true,
                      notes: "",
                    });
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
      {showEditIDModal && selectedStudentID && (
        <>
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                  <Edit2 className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Edit Student ID</h3>
                  <p className="text-sm text-gray-600">Update student ID information</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={idFormData.student_id}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, student_id: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="Enter student ID..."
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    name="edit-student-id-field"
                    data-form-type="other"
                    data-lp-ignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-kwimpalastatus="ignore"
                    formNoValidate
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={idFormData.notes}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="Enter student name..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    name="edit-student-name-field"
                    data-form-type="other"
                    data-lp-ignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-kwimpalastatus="ignore"
                    formNoValidate
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={idFormData.is_active}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                  />
                  <label htmlFor="edit_is_active" className="text-sm font-medium text-gray-700">
                    Active (students can use this ID for registration)
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleEditStudentID}
                  disabled={idActionLoading}
                  className="flex-1 bg-yellow-600 text-white py-3 px-4 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {idActionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Edit2 className="h-4 w-4" />
                      <span>Update Student ID</span>
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowEditIDModal(false);
                    setSelectedStudentID(null);
                    setIdFormData({
                      student_id: "",
                      is_active: true,
                      notes: "",
                    });
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

      {/* Delete Student ID Modal */}
      {showDeleteIDModal && selectedStudentID && (
        <>
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-white/20">
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
                    <span className="text-sm font-medium text-gray-500">Student Name:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudentID.notes || "Not specified"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className="text-sm font-semibold">
                      {selectedStudentID.is_active ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-red-600">Inactive</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-red-600 font-medium">
                  ⚠️ Warning: Deleting this student ID will prevent students from using it for registration. This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteStudentID}
                  disabled={idActionLoading}
                  className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {idActionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Student ID</span>
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteIDModal(false);
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
      {showViewIDModal && selectedStudentID && (
        <>
          <div className="fixed inset-0 backdrop-blur-xl z-40" />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Student ID Details</h3>
                  <p className="text-sm text-gray-600">View complete student ID information</p>
                </div>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Student ID:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudentID.student_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Student Name:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedStudentID.notes || "Not specified"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className="text-sm font-semibold">
                      {selectedStudentID.is_active ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-red-600">Inactive</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Created:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(selectedStudentID.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Last Updated:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(selectedStudentID.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowViewIDModal(false);
                    setSelectedStudentID(null);
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Summary Details Modal */}
      {showSummaryDetails && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSummaryDetails(false)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-sorsuMaroon to-sorsuMaroon/90 text-white p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold font-playfair capitalize">
                      {summaryType.replace(/_/g, ' ')} Details
                    </h2>
                    <p className="text-sm opacity-90 mt-1">
                      Total: {getSummaryData.length} items
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSummaryDetails(false)}
                    className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {paginatedSummaryData.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <FileText className="h-16 w-16 mx-auto" />
                    </div>
                    <p className="text-gray-500">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedSummaryData.map((item: RequestRow | StudentProfile | StudentID) => {
                      // Request Data
                      if (summaryType === 'total' || summaryType === 'pending' || summaryType === 'processing' || summaryType === 'ready' || summaryType === 'completed') {
                        const requestItem = item as RequestRow;
                        return (
                          <div 
                            key={requestItem.id}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-all duration-200"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">
                                    {requestItem.document_type || 'N/A'}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    ID: {requestItem.id}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[requestItem.status] || 'bg-gray-100 text-gray-800'}`}>
                                    {requestItem.status}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Student:</span>
                                  <p className="font-medium text-gray-900">{requestItem.profiles?.full_name || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Student ID:</span>
                                  <p className="font-medium text-gray-900">{requestItem.profiles?.student_id || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Email:</span>
                                  <p className="font-medium text-gray-900 text-xs truncate">{requestItem.profiles?.email_address || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Course:</span>
                                  <p className="font-medium text-gray-900">{requestItem.profiles?.course_program || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Contact:</span>
                                  <p className="font-medium text-gray-900">{requestItem.profiles?.contact_number || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Year Level:</span>
                                  <p className="font-medium text-gray-900">{requestItem.year_level || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Created:</span>
                                  <p className="font-medium text-gray-900">{new Date(requestItem.created_at).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Updated:</span>
                                  <p className="font-medium text-gray-900">{new Date(requestItem.updated_at).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Verification:</span>
                                  <p className="font-medium text-gray-900">
                                    {requestItem.verification_url ? (
                                      <a 
                                        href={getVerificationUrl(requestItem.verification_url)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        View File
                                      </a>
                                    ) : 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // Student Data
                      if (summaryType === 'total_students' || summaryType === 'pending_approvals') {
                        const studentItem = item as StudentProfile;
                        return (
                          <div 
                            key={studentItem.id}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-all duration-200"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">
                                    {studentItem.full_name || 'N/A'}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    ID: {studentItem.student_id}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {studentItem.is_approved ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Approved
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Email:</span>
                                  <p className="font-medium text-gray-900 text-xs truncate">{studentItem.email_address || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Course:</span>
                                  <p className="font-medium text-gray-900">{studentItem.course_program || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Contact:</span>
                                  <p className="font-medium text-gray-900">{studentItem.contact_number || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Registered:</span>
                                  <p className="font-medium text-gray-900">{new Date(studentItem.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // Student ID Data
                      if (summaryType === 'student_ids') {
                        const studentIdItem = item as StudentID;
                        return (
                          <div 
                            key={studentIdItem.id}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-all duration-200"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">
                                    {studentIdItem.student_id || 'N/A'}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    ID: {studentIdItem.id}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {studentIdItem.is_active ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Active
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Notes:</span>
                                  <p className="font-medium text-gray-900">{studentIdItem.notes || 'No notes'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Created:</span>
                                  <p className="font-medium text-gray-900">{new Date(studentIdItem.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      return null;
                    })}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {summaryTotalPages > 1 && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {((summaryCurrentPage - 1) * summaryItemsPerPage) + 1} to {Math.min(summaryCurrentPage * summaryItemsPerPage, getSummaryData.length)} of {getSummaryData.length} results
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSummaryCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={summaryCurrentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(summaryTotalPages, 5) }, (_, i: number) => {
                          let pageNum: number;
                          if (summaryTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (summaryCurrentPage <= 3) {
                            pageNum = i + 1;
                          } else if (summaryCurrentPage >= summaryTotalPages - 2) {
                            pageNum = summaryTotalPages - 4 + i;
                          } else {
                            pageNum = summaryCurrentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setSummaryCurrentPage(pageNum)}
                              className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                                summaryCurrentPage === pageNum
                                  ? 'bg-sorsuMaroon text-white'
                                  : 'border border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setSummaryCurrentPage(prev => Math.min(prev + 1, summaryTotalPages))}
                        disabled={summaryCurrentPage === summaryTotalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
