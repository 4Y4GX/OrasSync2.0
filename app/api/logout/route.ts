import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ message: "OK" });
  res.cookies.set("timea_session", "", { path: "/", maxAge: 0 });
  return res;
}
