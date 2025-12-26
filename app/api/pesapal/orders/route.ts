import { NextRequest, NextResponse } from "next/server";
import { submitOrderRequest } from "@/lib/pesapal";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const order = await submitOrderRequest(body);
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
