import { NextRequest, NextResponse } from "next/server";
import { listIpns, registerIpn } from "@/lib/pesapal";

export async function GET() {
  try {
    const ipns = await listIpns();
    return NextResponse.json(ipns);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ipn = await registerIpn({
      url: body.url,
      ipnNotificationType: body.ipnNotificationType,
    });
    return NextResponse.json(ipn);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
