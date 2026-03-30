import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    console.log("=== Identity Verification File Access ===");
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Missing environment variables" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Await the params to get the path
    const resolvedParams = await params;

    // Extract path from params
    let filePath: string;
    if (resolvedParams.path && resolvedParams.path.length > 0) {
      filePath = resolvedParams.path.join('/');
    } else {
      // Fallback: extract from URL
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/').filter(segment => segment);
      const apiIndex = pathSegments.indexOf('identity-verifications');
      if (apiIndex !== -1 && pathSegments.length > apiIndex + 1) {
        filePath = pathSegments.slice(apiIndex + 1).join('/');
      } else {
        return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
      }
    }

    console.log("Requested file path:", filePath);

    // Validate path format (should be userId/filename)
    const pathParts = filePath.split('/');
    if (pathParts.length !== 2) {
      return NextResponse.json({ error: "Invalid path format. Expected: userId/filename" }, { status: 400 });
    }

    const [userId, fileName] = pathParts;
    console.log("Extracted userId:", userId, "fileName:", fileName);

    // Try signed URL from identity-verifications bucket first
    console.log("Trying signed URL from identity-verifications bucket...");
    try {
      const { data, error } = await supabase.storage
        .from('identity-verifications')
        .createSignedUrl(filePath, 3600);
      
      if (!error && data?.signedUrl) {
        console.log("✅ Signed URL generated successfully");
        return NextResponse.redirect(data.signedUrl);
      }
      console.log("❌ Signed URL failed:", error?.message);
    } catch (err) {
      console.log("❌ Signed URL exception:", err);
    }

    // Try signed URL from documents bucket (fallback)
    console.log("Trying signed URL from documents bucket...");
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600);
      
      if (!error && data?.signedUrl) {
        console.log("✅ Signed URL generated successfully from documents bucket");
        return NextResponse.redirect(data.signedUrl);
      }
      console.log("❌ Documents bucket signed URL failed:", error?.message);
    } catch (err) {
      console.log("❌ Documents bucket signed URL exception:", err);
    }

    // Try public URL from identity-verifications bucket
    console.log("Trying public URL from identity-verifications bucket...");
    try {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/identity-verifications/${filePath}`;
      const response = await fetch(publicUrl, { method: 'HEAD' });
      
      if (response.ok) {
        console.log("✅ Public URL accessible");
        return NextResponse.redirect(publicUrl);
      }
      console.log("❌ Public URL failed:", response.status);
    } catch (err) {
      console.log("❌ Public URL exception:", err);
    }

    // Try public URL from documents bucket
    console.log("Trying public URL from documents bucket...");
    try {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
      const response = await fetch(publicUrl, { method: 'HEAD' });
      
      if (response.ok) {
        console.log("✅ Public URL accessible from documents bucket");
        return NextResponse.redirect(publicUrl);
      }
      console.log("❌ Documents public URL failed:", response.status);
    } catch (err) {
      console.log("❌ Documents public URL exception:", err);
    }

    return NextResponse.json(
      { 
        error: "File not found in any storage location",
        path: filePath,
        tried: [
          "identity-verifications signed URL",
          "documents signed URL", 
          "identity-verifications public URL",
          "documents public URL"
        ]
      },
      { status: 404 }
    );

  } catch (error) {
    console.error("Identity verification file access error:", error);
    return NextResponse.json(
      { 
        error: "File access failed", 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
