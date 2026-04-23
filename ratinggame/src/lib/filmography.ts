export interface FilmographyPerson {
  name: string;
  type: "director" | "actor";
  emoji: string;
  movies: string[]; // IMDB IDs — at least 5
}

export const FILMOGRAPHY_POOL: FilmographyPerson[] = [
  // ── Directors ────────────────────────────────────────────────────────────
  {
    name: "Christopher Nolan",
    type: "director",
    emoji: "🌀",
    movies: ["tt0468569", "tt1375666", "tt0816692", "tt0482571", "tt1345836", "tt0209144", "tt5013056"],
  },
  {
    name: "Quentin Tarantino",
    type: "director",
    emoji: "🩸",
    movies: ["tt0110912", "tt1853728", "tt0361748", "tt0105236", "tt0266697", "tt3460252"],
  },
  {
    name: "Steven Spielberg",
    type: "director",
    emoji: "🦕",
    movies: ["tt0108052", "tt0082971", "tt0120815", "tt0073195", "tt0107290", "tt0097576"],
  },
  {
    name: "Martin Scorsese",
    type: "director",
    emoji: "🎞️",
    movies: ["tt0099685", "tt0407887", "tt0075314", "tt0081398", "tt0993846", "tt1130884"],
  },
  {
    name: "Stanley Kubrick",
    type: "director",
    emoji: "👁️",
    movies: ["tt0062622", "tt0081505", "tt0093058", "tt0057012", "tt0066921", "tt0050825"],
  },
  {
    name: "David Fincher",
    type: "director",
    emoji: "🔍",
    movies: ["tt0137523", "tt0114369", "tt1285016", "tt0443706", "tt2267998"],
  },
  {
    name: "Hayao Miyazaki",
    type: "director",
    emoji: "🌬️",
    movies: ["tt0245429", "tt0096283", "tt0119698", "tt0092067", "tt0347149"],
  },
  {
    name: "The Coen Brothers",
    type: "director",
    emoji: "🤠",
    movies: ["tt0116282", "tt0118715", "tt0477348", "tt1403865", "tt0093822"],
  },
  {
    name: "Ridley Scott",
    type: "director",
    emoji: "⚔️",
    movies: ["tt0172495", "tt0078748", "tt0083658", "tt0089218", "tt3783958"],
  },
  {
    name: "James Cameron",
    type: "director",
    emoji: "🌊",
    movies: ["tt0120338", "tt0103064", "tt0082685", "tt0113189", "tt0499549"],
  },
  // ── Actors ────────────────────────────────────────────────────────────────
  {
    name: "Leonardo DiCaprio",
    type: "actor",
    emoji: "🦁",
    movies: ["tt0407887", "tt1375666", "tt1853728", "tt0993846", "tt1130884", "tt1663202"],
  },
  {
    name: "Tom Hanks",
    type: "actor",
    emoji: "🍫",
    movies: ["tt0109830", "tt0120815", "tt0120689", "tt0162222", "tt0107818", "tt0264464"],
  },
  {
    name: "Brad Pitt",
    type: "actor",
    emoji: "☀️",
    movies: ["tt0137523", "tt0114369", "tt0361748", "tt0208092", "tt0114746", "tt7131622"],
  },
  {
    name: "Robert De Niro",
    type: "actor",
    emoji: "🚕",
    movies: ["tt0071562", "tt0099685", "tt0075314", "tt0081398", "tt0077416", "tt0113277"],
  },
  {
    name: "Jack Nicholson",
    type: "actor",
    emoji: "😈",
    movies: ["tt0073486", "tt0081505", "tt0407887", "tt0071315", "tt0119822"],
  },
  {
    name: "Joaquin Phoenix",
    type: "actor",
    emoji: "🃏",
    movies: ["tt7286456", "tt1798709", "tt0358273", "tt1560747", "tt0172495"],
  },
  {
    name: "Meryl Streep",
    type: "actor",
    emoji: "👑",
    movies: ["tt0079417", "tt0084707", "tt0458352", "tt0089755", "tt1071034"],
  },
  {
    name: "Cate Blanchett",
    type: "actor",
    emoji: "🧝",
    movies: ["tt0120737", "tt0167260", "tt0167261", "tt2980516", "tt1412386"],
  },
];

export function samplePeople(count: number): FilmographyPerson[] {
  const shuffled = [...FILMOGRAPHY_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function sampleMovies(person: FilmographyPerson, count: number): string[] {
  const shuffled = [...person.movies].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
