// app/api/supervisor/settings/preferences/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ message: "Not Implemented" }, { status: 501 });
}

export async function PUT() {
  return NextResponse.json({ message: "Not Implemented" }, { status: 501 });
}