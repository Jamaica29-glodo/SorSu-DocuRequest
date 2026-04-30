import { NextResponse } from "next/server";

export async function POST() {
  console.log('=== TEST LOGOUT API WORKING ===');
  console.log('Timestamp:', new Date().toISOString());
  
  return NextResponse.json({ 
    success: true, 
    message: "Test logout API is working",
    timestamp: new Date().toISOString()
  });
}
