import { redirect } from "next/navigation";

// CineRating no longer has its own home — all games live in the unified hub at
// cinelinks.vercel.app. The individual rating modes still work at /versus, /career
// and /game; this root just sends visitors to the hub.
export default function Home() {
  redirect("https://cinelinks.vercel.app");
}
