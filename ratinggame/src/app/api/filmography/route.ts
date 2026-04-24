import { NextRequest, NextResponse } from "next/server";
import { samplePeople, sampleMovies } from "@/lib/filmography";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(parseInt(searchParams.get("count") ?? "1"), 24);

  const people = samplePeople(count);
  const challenges = people.map((person) => ({
    name: person.name,
    type: person.type,
    wikipediaSlug: person.wikipediaSlug,
    movieIds: sampleMovies(person, 4),
  }));

  return NextResponse.json({ challenges });
}
