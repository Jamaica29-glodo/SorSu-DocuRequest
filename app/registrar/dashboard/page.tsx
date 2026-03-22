"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  FileLock,
  ShieldCheck,
  User,
  Mail,
  Phone,
  BookOpen,
  ChevronLeft,
  Calendar,
  ExternalLink,
  Filter,
  TrendingUp,
  Users,
  FileCheck,
  Activity,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";
import { encryptAesGcm, uint8ToBase64 } from "@/app/lib/aesGcm";
import LogoutConfirmationModal from "@/components/ui/LogoutConfirmationModal";

type RequestRow = {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  created_at: string;
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
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.role !== "registrar") {
        router.push("/student/home");
        return;
      }

      await fetchRequests();
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
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-sorsuMaroon bg-clip-text text-transparent">Registrar Portal</h1>
              <p className="text-xs text-gray-500 hidden md:block">Document Request Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Activity className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">System Active</span>
            </div>
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
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-sorsuMaroon" />
                    Overview Statistics
                  </h2>
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-gray-200/50 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Total Requests</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-amber-200/50 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Pending</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-blue-200/50 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-700">{stats.processing}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Processing</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-purple-200/50 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-purple-700">{stats.ready}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Ready</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <FileCheck className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-emerald-200/50 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Completed</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Student Information Requests Section */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Request List */}
              <div className={`
                ${selectedRequestId ? 'hidden md:flex' : 'flex'} 
                w-full md:w-[350px] lg:w-[400px] flex-col overflow-hidden border-r border-gray-200/60 bg-white/90 backdrop-blur transition-all duration-300
              `}>
              <div className="p-4 border-b border-gray-100/80 bg-gradient-to-r from-gray-50 to-white">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search requests, names, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-sorsuMaroon focus:ring-2 focus:ring-sorsuMaroon/10 outline-none transition-all duration-200 shadow-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200/60 bg-white/80 backdrop-blur px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon/10 outline-none transition-all"
                    >
                      <option value="all">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="On Process">On Process</option>
                      <option value="Ready for Pick-up">Ready for Pick-up</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg font-medium">
                      {filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gradient-to-b from-white to-gray-50/30 transition-colors pt-4">
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-8 px-4 text-gray-400">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                      <FileText className="h-6 w-6 opacity-30" />
                    </div>
                    <p className="text-xs font-medium text-gray-500">No requests found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  filteredRequests.map((r) => {
                    const ItemIcon = STATUS_ICONS[r.status] || AlertCircle;
                    const isSelected = selectedRequestId === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedRequestId(r.id);
                          setError(null);
                          setSuccessMessage(null);
                          setDecryptionKey("");
                          setFile(null);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-300 group ${
                          isSelected
                            ? "bg-gradient-to-r from-sorsuMaroon/5 to-sorsuMaroon/10 border-sorsuMaroon/30 ring-2 ring-sorsuMaroon/20 shadow-lg scale-[1.02]"
                            : "bg-white/80 backdrop-blur border-gray-200/50 hover:bg-gray-50/80 hover:border-gray-300/60 hover:shadow-md hover:scale-[1.01]"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-xs mb-1 line-clamp-1 group-hover:text-sorsuMaroon transition-colors">
                              {r.document_type}
                            </h3>
                            <p className="text-xs text-gray-600 font-medium block mb-1">
                              {r.profiles?.full_name || "N/A"}
                            </p>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                {r.profiles?.student_id || "No ID"}
                              </span>
                              {r.year_level && (
                                <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                                  {r.year_level}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {r.encrypted_file_path && (
                              <div className="h-6 w-6 rounded-lg bg-emerald-100 flex items-center justify-center shadow-sm">
                                <FileLock className="h-3 w-3 text-emerald-600" />
                              </div>
                            )}
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold border shadow-sm ${
                                STATUS_COLORS[r.status] || "bg-gray-100 text-gray-800 border-gray-200"
                              }`}
                            >
                              <ItemIcon className="h-2.5 w-2.5" />
                              {r.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(r.created_at).toLocaleDateString(undefined, { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                          <div className="text-gray-400">
                            {r.id.slice(0, 6).toUpperCase()}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Details & Actions */}
            <div className={`
              flex-1 flex-col overflow-y-auto bg-gradient-to-b from-gray-50/30 to-white/50 transition-all duration-300 ${
                selectedRequestId ? 'flex' : 'hidden md:flex'
              }`}
            >
              {selectedRequestId && (
                <div className="md:hidden p-4 bg-white/90 backdrop-blur border-b border-gray-200/60 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                  <button 
                    onClick={() => setSelectedRequestId("")}
                    className="flex items-center gap-2 text-sm font-bold text-sorsuMaroon hover:text-sorsuMaroon/80 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" /> 
                    <span>Back to Requests</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border shadow-sm ${
                      STATUS_COLORS[selectedRequest.status] || "bg-gray-100 text-gray-800 border-gray-200"
                    }`}>
                      <StatusIcon className="h-3 w-3" />
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>
              )}

              <div className={`p-4 md:p-6 space-y-6 ${selectedRequestId ? '' : 'flex items-center justify-center h-full'}`}>
                {error && (
                  <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 p-4 text-sm text-rose-800 animate-in fade-in slide-in-from-top-2 shadow-lg">
                    <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Error</p>
                      <p className="text-xs text-rose-600 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-4 text-sm text-emerald-800 animate-in fade-in slide-in-from-top-2 shadow-lg">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Success</p>
                      <p className="text-xs text-emerald-600 mt-1">{successMessage}</p>
                    </div>
                  </div>
                )}

                {!selectedRequest ? (
                  <div className="flex flex-col items-center justify-center text-gray-400 max-w-lg">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center shadow-lg mb-6 border border-gray-200/50">
                      <FileText className="h-12 w-12 opacity-30" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Request</h2>
                    <p className="text-sm text-gray-500 text-center mb-6">Choose a document request from the list to view details and manage processing.</p>
                    <div className="flex flex-col items-center gap-3 text-xs text-gray-400 bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></div>
                        <span>Pending requests need attention</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span>Completed requests are ready</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                        <span>Click any request to begin</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Enhanced Header Info Card */}
                    <div className="rounded-2xl bg-white/95 backdrop-blur border border-gray-200/60 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
                      <div className="bg-gradient-to-r from-sorsuMaroon via-sorsuMaroon/90 to-sorsuMaroon/80 h-3 w-full"></div>
                      <div className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-sorsuMaroon uppercase tracking-wider mb-3">
                              <FileText className="h-4 w-4" /> 
                              <span>Request Details</span>
                              <div className="h-px flex-1 bg-sorsuMaroon/20 mx-2"></div>
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-black text-gray-900 mb-2 leading-tight">
                              {selectedRequest.document_type}
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              <span className="bg-gray-100 px-3 py-1 rounded-lg font-mono text-xs font-semibold border border-gray-200">
                                ID: {selectedRequest.id.slice(0, 8).toUpperCase()}...
                              </span>
                              <span className="flex items-center gap-1 text-xs">
                                <Calendar className="h-3 w-3" />
                                {new Date(selectedRequest.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold border shadow-lg ${
                                STATUS_COLORS[selectedRequest.status] ||
                                "bg-gray-100 text-gray-800 border-gray-200"
                              }`}
                            >
                              <StatusIcon className="h-5 w-5" />
                              {selectedRequest.status}
                            </span>
                            {selectedRequest.encrypted_file_path && (
                              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                                <FileLock className="h-3 w-3" />
                                <span className="font-medium">Secure Document</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Enhanced Student Information Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-gradient-to-br from-gray-50/50 to-white rounded-2xl border border-gray-100/80 transition-all duration-300">
                          <div className="space-y-2 group">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <User className="h-3 w-3" /> 
                              <span>Full Name</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 group-hover:text-sorsuMaroon transition-colors">
                              {selectedRequest.profiles?.full_name || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2 group">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <Mail className="h-3 w-3" /> 
                              <span>Email Address</span>
                            </div>
                            <p className="text-sm font-medium text-gray-600 truncate group-hover:text-sorsuMaroon/80 transition-colors">
                              {selectedRequest.profiles?.email_address || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2 group">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <BookOpen className="h-3 w-3" /> 
                              <span>Course & Year</span>
                            </div>
                            <p className="text-sm font-medium text-gray-600 group-hover:text-sorsuMaroon/80 transition-colors">
                              {selectedRequest.profiles?.course_program || "N/A"} 
                              {selectedRequest.year_level && (
                                <span className="ml-1 text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded text-xs">
                                  {selectedRequest.year_level}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="space-y-2 group">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <Phone className="h-3 w-3" /> 
                              <span>Contact Number</span>
                            </div>
                            <p className="text-sm font-medium text-gray-600 group-hover:text-sorsuMaroon/80 transition-colors">
                              {selectedRequest.profiles?.contact_number || "N/A"}
                            </p>
                          </div>
                        </div>

                        {selectedRequest.verification_url && (
                          <div className="mt-6">
                            <button 
                              onClick={async () => {
                                if (selectedRequest.verification_url) {
                                  const parts = selectedRequest.verification_url.split("/");
                                  if (parts.length >= 2) {
                                    const bucket = parts[0];
                                    const path = parts.slice(1).join("/");
                                    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
                                    if (data?.signedUrl) {
                                      window.open(data.signedUrl, "_blank");
                                    }
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-2 text-sm font-bold text-sorsuMaroon hover:text-sorsuMaroon/80 bg-gradient-to-r from-sorsuMaroon/5 to-sorsuMaroon/10 hover:from-sorsuMaroon/10 hover:to-sorsuMaroon/20 px-4 py-3 rounded-xl transition-all duration-200 border border-sorsuMaroon/20 hover:border-sorsuMaroon/30 shadow-sm hover:shadow-md"
                            >
                              <ExternalLink className="h-4 w-4" /> 
                              <span>View Verification Document</span>
                              <div className="h-2 w-2 rounded-full bg-sorsuMaroon animate-pulse"></div>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Enhanced Status Update Form */}
                      <div className="rounded-2xl bg-white/95 backdrop-blur border border-gray-200/60 shadow-lg p-6 transition-all duration-300 hover:shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center border border-blue-200">
                            <RefreshCw className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-gray-900 uppercase tracking-wide">Update Status</h3>
                            <p className="text-xs text-gray-500">Change request processing status</p>
                          </div>
                        </div>
                        <form onSubmit={handleUpdateStatus} className="space-y-5">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                              New Status
                            </label>
                            <select
                              value={statusToSet}
                              onChange={(e) => setStatusToSet(e.target.value)}
                              className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-4 py-3 text-sm font-semibold focus:border-sorsuMaroon focus:ring-2 focus:ring-sorsuMaroon/10 outline-none transition-all duration-200 shadow-sm"
                            >
                              <option value="Pending">⏳ Pending</option>
                              <option value="On Process">🔄 On Process</option>
                              <option value="Ready for Pick-up">📦 Ready for Pick-up</option>
                              <option value="Completed">✅ Completed</option>
                              <option value="Cancelled">❌ Cancelled</option>
                            </select>
                          </div>

                          {statusToSet === "Cancelled" && (
                            <div className="animate-in slide-in-from-top-2 duration-300">
                              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                                Reason for Cancellation
                              </label>
                              <textarea
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-4 py-3 text-sm focus:border-sorsuMaroon focus:ring-2 focus:ring-sorsuMaroon/10 outline-none min-h-[100px] transition-all duration-200 shadow-sm resize-none"
                                placeholder="e.g., Missing requirements, please re-upload documents..."
                              />
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={updatingStatus}
                            className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-3.5 text-sm font-black text-white hover:from-gray-800 hover:to-gray-900 disabled:opacity-60 transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-2"
                          >
                            {updatingStatus ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> 
                                <span>Updating Status...</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4" /> 
                                <span>Update Request Status</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Enhanced File Upload Form */}
                      <div className="rounded-2xl bg-white/95 backdrop-blur border border-gray-200/60 shadow-lg p-6 transition-all duration-300 hover:shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center border border-emerald-200">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-gray-900 uppercase tracking-wide">Secure Upload</h3>
                            <p className="text-xs text-gray-500">Upload encrypted document</p>
                          </div>
                        </div>
                        <form onSubmit={handleUploadEncryptedDocument} className="space-y-5">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                              Select Document
                            </label>
                            <div className="relative group">
                              <input
                                type="file"
                                onChange={handleFileChange}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gradient-to-r file:from-sorsuMaroon/10 file:to-sorsuMaroon/5 file:text-sorsuMaroon hover:file:from-sorsuMaroon/20 hover:file:to-sorsuMaroon/10 border border-gray-200 rounded-xl cursor-pointer bg-gray-50/50 p-2 transition-all duration-200 hover:border-sorsuMaroon/30 file:transition-all"
                              />
                              {file && (
                                <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                              Encryption Key
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  value={decryptionKey}
                                  onChange={handleKeyChange}
                                  className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 pl-10 pr-3 py-3 text-sm font-mono focus:border-sorsuMaroon focus:ring-2 focus:ring-sorsuMaroon/10 outline-none transition-all duration-200 shadow-sm"
                                  placeholder="Generate or enter key..."
                                />
                                {isSavingKey && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-4 w-4 animate-spin text-sorsuMaroon" />
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={handleGenerateKey}
                                className="p-3 rounded-xl bg-gradient-to-r from-sorsuMaroon/10 to-sorsuMaroon/5 hover:from-sorsuMaroon/20 hover:to-sorsuMaroon/10 border border-sorsuMaroon/20 hover:border-sorsuMaroon/30 text-sorsuMaroon transition-all duration-200 shadow-sm hover:shadow-md"
                                title="Generate New Key"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCopyKey}
                                className="p-3 rounded-xl bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 border border-gray-200 hover:border-gray-300 text-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
                                title="Copy Key"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                              Post-Upload Status
                            </label>
                            <select
                              value={statusAfterUpload}
                              onChange={(e) => setStatusAfterUpload(e.target.value)}
                              className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-4 py-3 text-sm font-semibold focus:border-sorsuMaroon focus:ring-2 focus:ring-sorsuMaroon/10 outline-none transition-all duration-200 shadow-sm"
                            >
                              <option value="Completed">✅ Completed</option>
                              <option value="Ready for Pick-up">📦 Ready for Pick-up</option>
                              <option value="On Process">🔄 On Process</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={uploading}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sorsuMaroon to-sorsuMaroon/90 hover:from-sorsuMaroon/90 hover:to-sorsuMaroon px-4 py-3.5 text-sm font-black text-white disabled:opacity-60 transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> 
                                <span>Encrypting & Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" /> 
                                <span>Encrypt & Upload Document</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Enhanced Secure File Info */}
                    {selectedRequest.encrypted_file_path && (
                      <div className="p-5 bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50 rounded-2xl border border-emerald-200/60 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-500 shadow-lg">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-700 shadow-inner border border-emerald-200">
                          <FileLock className="h-7 w-7" />
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-black text-emerald-900">
                            📄 Secure Document Uploaded
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-emerald-700 font-medium">
                              {selectedRequest.original_file_name}
                            </p>
                            <span className="text-emerald-400">•</span>
                            <p className="text-xs text-emerald-600">
                              {new Date(selectedRequest.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {selectedRequest.decryption_key && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-emerald-600 font-medium">Key Available:</span>
                              <span className="text-xs font-mono bg-emerald-100 px-2 py-1 rounded text-emerald-800">
                                {selectedRequest.decryption_key.slice(0, 8)}***
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}
      </main>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutConfirmation}
        onConfirm={confirmSignOut}
        onCancel={() => setShowLogoutConfirmation(false)}
      />
    </div>
  );
}
