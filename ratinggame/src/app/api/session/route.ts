import { NextRequest, NextResponse } from "next/server";
import { pickRandomMovies } from "@/lib/movies";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(parseInt(searchParams.get("count") ?? "10"), 30);
  const movies = pickRandomMovies(count);
  return NextResponse.json({ movies });
}
