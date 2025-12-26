import { NextRequest, NextResponse } from "next/server";
import { appendIpnLog, readIpnLog } from "@/lib/ipn-log";

export async function GET() {
  try {
    const entries = await readIpnLog();
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const entry = await appendIpnLog(rawBody);
    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
