import { NextRequest, NextResponse } from "next/server";
import { cancelOrder } from "@/lib/pesapal";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderTrackingId = body.orderTrackingId || body.order_tracking_id;
    if (!orderTrackingId) {
      return NextResponse.json(
        { error: "orderTrackingId is required" },
        { status: 400 },
      );
    }
    const result = await cancelOrder(orderTrackingId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
