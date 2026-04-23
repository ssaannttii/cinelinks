import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ photo: null }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      {
        headers: { "User-Agent": "CineRating/1.0 (https://cinerating.vercel.app)" },
        next: { revalidate: 86400 }, // cache 24h
      }
    );

    if (!res.ok) {
      return NextResponse.json({ photo: null });
    }

    const data = await res.json();
    const photo = data?.thumbnail?.source ?? null;
    return NextResponse.json({ photo });
  } catch {
    return NextResponse.json({ photo: null });
  }
}
