import { NextRequest, NextResponse } from "next/server";

export interface OmdbMovie {
  Title: string;
  Year: string;
  Rated: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Plot: string;
  Poster: string;
  imdbRating: string;
  imdbID: string;
  Ratings: { Source: string; Value: string }[];
  Response: string;
  Error?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imdbId = searchParams.get("id");

  if (!imdbId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OMDB API key not configured" }, { status: 500 });
  }

  const url = `https://www.omdbapi.com/?i=${imdbId}&plot=short&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
    const data: OmdbMovie = await res.json();

    if (data.Response === "False") {
      return NextResponse.json({ error: data.Error || "Movie not found" }, { status: 404 });
    }

    // Only expose what the game needs — hide rating until reveal
    return NextResponse.json({
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      rated: data.Rated,
      runtime: data.Runtime,
      genre: data.Genre,
      director: data.Director,
      plot: data.Plot,
      poster: data.Poster,
      imdbRating: data.imdbRating,
      rtRating: data.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value ?? "N/A",
      metacritic: data.Ratings?.find((r) => r.Source === "Metacritic")?.Value ?? "N/A",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch movie data" }, { status: 500 });
  }
}
