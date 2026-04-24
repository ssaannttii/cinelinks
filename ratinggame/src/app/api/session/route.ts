import { NextRequest, NextResponse } from "next/server";
import { pickBalancedPairs } from "@/lib/movies";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(parseInt(searchParams.get("count") ?? "10"), 20);
  const pairs = pickBalancedPairs(count);
  return NextResponse.json({ pairs });
}
