export interface FilmographyPerson {
  name: string;
  type: "director" | "actor";
  wikipediaSlug: string; // for photo via Wikipedia REST API
  movies: string[]; // IMDB IDs — at least 5
}

export const FILMOGRAPHY_POOL: FilmographyPerson[] = [
  // ── Directors ────────────────────────────────────────────────────────────
  {
    name: "Christopher Nolan",
    type: "director",
    wikipediaSlug: "Christopher_Nolan",
    movies: ["tt0468569", "tt1375666", "tt0816692", "tt0482571", "tt1345836", "tt0209144", "tt5013056"],
  },
  {
    name: "Quentin Tarantino",
    type: "director",
    wikipediaSlug: "Quentin_Tarantino",
    movies: ["tt0110912", "tt1853728", "tt0361748", "tt0105236", "tt0266697", "tt3460252", "tt7131622"],
  },
  {
    name: "Steven Spielberg",
    type: "director",
    wikipediaSlug: "Steven_Spielberg",
    movies: ["tt0108052", "tt0082971", "tt0120815", "tt0073195", "tt0107290", "tt0097576", "tt0264464"],
  },
  {
    name: "Martin Scorsese",
    type: "director",
    wikipediaSlug: "Martin_Scorsese",
    movies: ["tt0099685", "tt0407887", "tt0075314", "tt0081398", "tt0993846", "tt1130884", "tt0112641"],
  },
  {
    name: "Stanley Kubrick",
    type: "director",
    wikipediaSlug: "Stanley_Kubrick",
    movies: ["tt0062622", "tt0081505", "tt0093058", "tt0057012", "tt0066921", "tt0050825"],
  },
  {
    name: "David Fincher",
    type: "director",
    wikipediaSlug: "David_Fincher",
    movies: ["tt0137523", "tt0114369", "tt1285016", "tt0443706", "tt2267998", "tt1570728"],
  },
  {
    name: "Hayao Miyazaki",
    type: "director",
    wikipediaSlug: "Hayao_Miyazaki",
    movies: ["tt0245429", "tt0096283", "tt0119698", "tt0092067", "tt0347149"],
  },
  {
    name: "Joel & Ethan Coen",
    type: "director",
    wikipediaSlug: "Coen_brothers",
    movies: ["tt0116282", "tt0118715", "tt0477348", "tt1403865", "tt0093822"],
  },
  {
    name: "Ridley Scott",
    type: "director",
    wikipediaSlug: "Ridley_Scott",
    movies: ["tt0172495", "tt0078748", "tt0083658", "tt0089218", "tt0265086"],
  },
  {
    name: "James Cameron",
    type: "director",
    wikipediaSlug: "James_Cameron",
    movies: ["tt0120338", "tt0103064", "tt0082685", "tt0113189", "tt0499549"],
  },
  {
    name: "Denis Villeneuve",
    type: "director",
    wikipediaSlug: "Denis_Villeneuve",
    movies: ["tt1160419", "tt15239678", "tt2543164", "tt1856101", "tt1570728", "tt3659388"],
  },
  {
    name: "Wes Anderson",
    type: "director",
    wikipediaSlug: "Wes_Anderson",
    movies: ["tt1185836", "tt0358273", "tt0265666", "tt1104001", "tt1748122"],
  },
  {
    name: "Alfonso Cuarón",
    type: "director",
    wikipediaSlug: "Alfonso_Cuarón",
    movies: ["tt6155172", "tt0366543", "tt0407304", "tt0317219", "tt0442933"],
  },
  {
    name: "Bong Joon-ho",
    type: "director",
    wikipediaSlug: "Bong_Joon-ho",
    movies: ["tt6751668", "tt1706620", "tt0468492", "tt0374260", "tt4729430"],
  },
  // ── Actors ────────────────────────────────────────────────────────────────
  {
    name: "Leonardo DiCaprio",
    type: "actor",
    wikipediaSlug: "Leonardo_DiCaprio",
    movies: ["tt0407887", "tt1375666", "tt1853728", "tt0993846", "tt1130884", "tt1663202"],
  },
  {
    name: "Tom Hanks",
    type: "actor",
    wikipediaSlug: "Tom_Hanks",
    movies: ["tt0109830", "tt0120815", "tt0120689", "tt0162222", "tt0107818", "tt0264464"],
  },
  {
    name: "Brad Pitt",
    type: "actor",
    wikipediaSlug: "Brad_Pitt",
    movies: ["tt0137523", "tt0114369", "tt0361748", "tt0208092", "tt0114746", "tt7131622"],
  },
  {
    name: "Robert De Niro",
    type: "actor",
    wikipediaSlug: "Robert_De_Niro",
    movies: ["tt0071562", "tt0099685", "tt0075314", "tt0081398", "tt0077416", "tt0113277"],
  },
  {
    name: "Jack Nicholson",
    type: "actor",
    wikipediaSlug: "Jack_Nicholson",
    movies: ["tt0073486", "tt0081505", "tt0407887", "tt0071315", "tt0119822"],
  },
  {
    name: "Joaquin Phoenix",
    type: "actor",
    wikipediaSlug: "Joaquin_Phoenix",
    movies: ["tt7286456", "tt1798709", "tt0358273", "tt1560747", "tt0172495"],
  },
  {
    name: "Meryl Streep",
    type: "actor",
    wikipediaSlug: "Meryl_Streep",
    movies: ["tt0079417", "tt0084707", "tt0458352", "tt0089755", "tt1071034"],
  },
  {
    name: "Cate Blanchett",
    type: "actor",
    wikipediaSlug: "Cate_Blanchett",
    movies: ["tt0120737", "tt0167260", "tt0167261", "tt2980516", "tt1412386"],
  },
  {
    name: "Denzel Washington",
    type: "actor",
    wikipediaSlug: "Denzel_Washington",
    movies: ["tt0120720", "tt0112462", "tt0264464", "tt0253835", "tt0448115"],
  },
  {
    name: "Daniel Day-Lewis",
    type: "actor",
    wikipediaSlug: "Daniel_Day-Lewis",
    movies: ["tt0469754", "tt1091478", "tt5776858", "tt0217505", "tt0097937", "tt0107308"],
  },
  // ── Additional Directors ──────────────────────────────────────────────────
  {
    name: "Sofia Coppola",
    type: "director",
    wikipediaSlug: "Sofia_Coppola",
    movies: ["tt0335266", "tt0159097", "tt0420704", "tt2073619", "tt1325004"],
  },
  {
    name: "Park Chan-wook",
    type: "director",
    wikipediaSlug: "Park_Chan-wook",
    movies: ["tt0364569", "tt4955566", "tt0260364", "tt1682180", "tt20215234"],
  },
  {
    name: "Akira Kurosawa",
    type: "director",
    wikipediaSlug: "Akira_Kurosawa",
    movies: ["tt0047478", "tt0042876", "tt0089881", "tt0044741", "tt0055630"],
  },
  {
    name: "Edgar Wright",
    type: "director",
    wikipediaSlug: "Edgar_Wright",
    movies: ["tt0365748", "tt0425112", "tt0446029", "tt3890160", "tt1213663"],
  },
  {
    name: "Kathryn Bigelow",
    type: "director",
    wikipediaSlug: "Kathryn_Bigelow",
    movies: ["tt1124035", "tt1790885", "tt0102685", "tt0114070", "tt0093605"],
  },
  // ── Additional Actors ─────────────────────────────────────────────────────
  {
    name: "Morgan Freeman",
    type: "actor",
    wikipediaSlug: "Morgan_Freeman",
    movies: ["tt0111161", "tt0114369", "tt0372784", "tt0097441", "tt0405159"],
  },
  {
    name: "Cillian Murphy",
    type: "actor",
    wikipediaSlug: "Cillian_Murphy",
    movies: ["tt15398776", "tt0372784", "tt0289043", "tt0460989", "tt5013056"],
  },
  {
    name: "Ryan Gosling",
    type: "actor",
    wikipediaSlug: "Ryan_Gosling",
    movies: ["tt3783958", "tt0780504", "tt1856101", "tt0332280", "tt0468489"],
  },
  {
    name: "Natalie Portman",
    type: "actor",
    wikipediaSlug: "Natalie_Portman",
    movies: ["tt0110413", "tt0434409", "tt0376541", "tt0800369", "tt1619029"],
  },
  {
    name: "Jake Gyllenhaal",
    type: "actor",
    wikipediaSlug: "Jake_Gyllenhaal",
    movies: ["tt0246578", "tt0388795", "tt0443706", "tt1570728", "tt2872718"],
  },
  // ── Popular / Mainstream ──────────────────────────────────────────────────
  {
    name: "Tom Cruise",
    type: "actor",
    wikipediaSlug: "Tom_Cruise",
    movies: ["tt0092099", "tt0117060", "tt0116695", "tt0104257", "tt0175880"],
  },
  {
    name: "Will Smith",
    type: "actor",
    wikipediaSlug: "Will_Smith",
    movies: ["tt0248667", "tt0454921", "tt0119654", "tt0120616", "tt9620288"],
  },
  {
    name: "Robert Downey Jr.",
    type: "actor",
    wikipediaSlug: "Robert_Downey_Jr.",
    movies: ["tt0371746", "tt0988045", "tt0103923", "tt0427944", "tt0848228"],
  },
  {
    name: "Keanu Reeves",
    type: "actor",
    wikipediaSlug: "Keanu_Reeves",
    movies: ["tt0133093", "tt2911666", "tt0111257", "tt4425200", "tt6823368"],
  },
  {
    name: "Tim Burton",
    type: "director",
    wikipediaSlug: "Tim_Burton",
    movies: ["tt0099487", "tt0094721", "tt0096895", "tt0319061", "tt0109592"],
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function samplePeople(count: number): FilmographyPerson[] {
  return shuffle(FILMOGRAPHY_POOL).slice(0, Math.min(count, FILMOGRAPHY_POOL.length));
}

export function sampleMovies(person: FilmographyPerson, count: number): string[] {
  return shuffle(person.movies).slice(0, Math.min(count, person.movies.length));
}
