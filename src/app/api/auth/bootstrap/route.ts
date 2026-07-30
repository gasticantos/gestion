import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "El alta inicial se realiza desde Supabase" }, { status: 410 });
}

export const POST = GET;
