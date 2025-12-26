import { NextRequest, NextResponse } from "next/server";
import { getTransactionStatus } from "@/lib/pesapal";

export async function GET(request: NextRequest) {
  try {
    const orderTrackingId = request.nextUrl.searchParams.get("orderTrackingId");
    if (!orderTrackingId) {
      return NextResponse.json(
        { error: "orderTrackingId query parameter is required" },
        { status: 400 },
      );
    }
    const status = await getTransactionStatus(orderTrackingId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
