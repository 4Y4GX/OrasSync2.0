import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Returns the absolute server Unix timestamp
  return NextResponse.json({ serverTime: Date.now() });
}