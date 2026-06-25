import { NextRequest, NextResponse } from "next/server";
import { pickBalancedPairs } from "@/lib/movies";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(parseInt(searchParams.get("count") ?? "10"), 20);
  const exclude = new Set(
    (searchParams.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const pairs = pickBalancedPairs(count, exclude);
  return NextResponse.json({ pairs });
}
