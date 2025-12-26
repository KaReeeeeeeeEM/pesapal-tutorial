import { NextResponse } from "next/server";
import { requestAccessToken } from "@/lib/pesapal";

export async function POST() {
  try {
    const token = await requestAccessToken();
    return NextResponse.json(token);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
