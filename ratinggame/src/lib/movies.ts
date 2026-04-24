// Curated film pool — broad mix of genres, eras, ratings
// Tiers: 1 = Elite (~8.3+), 2 = Great/Good (~7.0–8.2), 3 = Popular/Fun (~5.5–6.9)
export interface MovieStub {
  imdbId: string;
  title: string;
  year: string;
}

export const MOVIE_POOL: MovieStub[] = [
  // ── Tier 1 · Masterpieces ──────────────────────────────────────────────────
  { imdbId: "tt0111161", title: "The Shawshank Redemption",                  year: "1994" },
  { imdbId: "tt0068646", title: "The Godfather",                             year: "1972" },
  { imdbId: "tt0071562", title: "The Godfather Part II",                     year: "1974" },
  { imdbId: "tt0468569", title: "The Dark Knight",                           year: "2008" },
  { imdbId: "tt0050083", title: "12 Angry Men",                              year: "1957" },
  { imdbId: "tt0108052", title: "Schindler's List",                          year: "1993" },
  { imdbId: "tt0167260", title: "The Lord of the Rings: The Return of the King", year: "2003" },
  { imdbId: "tt0110912", title: "Pulp Fiction",                              year: "1994" },
  { imdbId: "tt0120737", title: "The Lord of the Rings: The Fellowship of the Ring", year: "2001" },
  { imdbId: "tt0060196", title: "The Good, the Bad and the Ugly",            year: "1966" },
  { imdbId: "tt1375666", title: "Inception",                                 year: "2010" },
  { imdbId: "tt0137523", title: "Fight Club",                                year: "1999" },
  { imdbId: "tt0245429", title: "Spirited Away",                             year: "2001" },
  { imdbId: "tt0816692", title: "Interstellar",                              year: "2014" },
  { imdbId: "tt0133093", title: "The Matrix",                                year: "1999" },
  { imdbId: "tt0099685", title: "Goodfellas",                                year: "1990" },
  { imdbId: "tt0120815", title: "Saving Private Ryan",                       year: "1998" },
  { imdbId: "tt0034583", title: "Casablanca",                                year: "1942" },
  { imdbId: "tt0082971", title: "Raiders of the Lost Ark",                   year: "1981" },
  { imdbId: "tt0047478", title: "Seven Samurai",                             year: "1954" },
  { imdbId: "tt0407887", title: "The Departed",                              year: "2006" },
  { imdbId: "tt2582802", title: "Whiplash",                                  year: "2014" },
  { imdbId: "tt0317248", title: "City of God",                               year: "2002" },
  { imdbId: "tt0057012", title: "Dr. Strangelove",                           year: "1964" },
  { imdbId: "tt0102926", title: "The Silence of the Lambs",                  year: "1991" },
  { imdbId: "tt0103064", title: "Terminator 2: Judgment Day",                year: "1991" },
  { imdbId: "tt0080684", title: "The Empire Strikes Back",                   year: "1980" },
  { imdbId: "tt0076759", title: "Star Wars: A New Hope",                     year: "1977" },
  { imdbId: "tt0038650", title: "It's a Wonderful Life",                     year: "1946" },
  { imdbId: "tt0078788", title: "Apocalypse Now",                            year: "1979" },
  { imdbId: "tt0110413", title: "Léon: The Professional",                    year: "1994" },
  { imdbId: "tt0118799", title: "Life Is Beautiful",                         year: "1997" },
  { imdbId: "tt0167261", title: "The Lord of the Rings: The Two Towers",     year: "2002" },
  { imdbId: "tt0081505", title: "The Shining",                               year: "1980" },
  { imdbId: "tt0093058", title: "Full Metal Jacket",                         year: "1987" },
  { imdbId: "tt0062622", title: "2001: A Space Odyssey",                     year: "1968" },
  { imdbId: "tt0086879", title: "Amadeus",                                   year: "1984" },
  { imdbId: "tt0073486", title: "One Flew Over the Cuckoo's Nest",           year: "1975" },
  { imdbId: "tt0253474", title: "The Pianist",                               year: "2002" },
  { imdbId: "tt6751668", title: "Parasite",                                  year: "2019" },
  { imdbId: "tt4633694", title: "Spider-Man: Into the Spider-Verse",         year: "2018" },
  { imdbId: "tt1392190", title: "Mad Max: Fury Road",                        year: "2015" },
  { imdbId: "tt8760708", title: "1917",                                      year: "2019" },
  { imdbId: "tt2380307", title: "Coco",                                      year: "2017" },
  { imdbId: "tt15398776", title: "Oppenheimer",                              year: "2023" },
  { imdbId: "tt0042876", title: "Rashomon",                                  year: "1950" },
  { imdbId: "tt0089881", title: "Ran",                                       year: "1985" },
  { imdbId: "tt0040522", title: "Bicycle Thieves",                           year: "1948" },
  { imdbId: "tt0046438", title: "Tokyo Story",                               year: "1953" },
  { imdbId: "tt1832382", title: "A Separation",                              year: "2011" },
  { imdbId: "tt0095765", title: "Cinema Paradiso",                           year: "1988" },
  { imdbId: "tt0211915", title: "Amélie",                                    year: "2001" },
  { imdbId: "tt1675434", title: "The Intouchables",                          year: "2011" },
  { imdbId: "tt0052311", title: "North by Northwest",                        year: "1959" },
  { imdbId: "tt0056592", title: "To Kill a Mockingbird",                     year: "1962" },
  { imdbId: "tt0364569", title: "Oldboy",                                    year: "2003" },
  { imdbId: "tt1187043", title: "3 Idiots",                                  year: "2009" },
  { imdbId: "tt0043014", title: "Sunset Boulevard",                          year: "1950" },
  { imdbId: "tt0044081", title: "Singin' in the Rain",                       year: "1952" },
  { imdbId: "tt0050825", title: "Paths of Glory",                            year: "1957" },
  { imdbId: "tt0114709", title: "Toy Story",                                 year: "1995" },
  { imdbId: "tt0910970", title: "WALL·E",                                    year: "2008" },
  { imdbId: "tt1049413", title: "Up",                                        year: "2009" },
  { imdbId: "tt0066921", title: "A Clockwork Orange",                        year: "1971" },
  { imdbId: "tt15239678", title: "Dune: Part Two",                           year: "2024" },
  { imdbId: "tt7286456", title: "Joker",                                     year: "2019" },
  { imdbId: "tt4154796", title: "Avengers: Endgame",                         year: "2019" },
  { imdbId: "tt4154756", title: "Avengers: Infinity War",                    year: "2018" },
  { imdbId: "tt0482571", title: "The Prestige",                              year: "2006" },
  { imdbId: "tt0120689", title: "The Green Mile",                            year: "1999" },
  { imdbId: "tt0361748", title: "Inglourious Basterds",                      year: "2009" },

  // ── Tier 2 · Great / Good ─────────────────────────────────────────────────
  { imdbId: "tt0109830", title: "Forrest Gump",                              year: "1994" },
  { imdbId: "tt0172495", title: "Gladiator",                                 year: "2000" },
  { imdbId: "tt1345836", title: "The Dark Knight Rises",                     year: "2012" },
  { imdbId: "tt0120586", title: "American History X",                        year: "1998" },
  { imdbId: "tt0114369", title: "Se7en",                                     year: "1995" },
  { imdbId: "tt0116282", title: "Fargo",                                     year: "1996" },
  { imdbId: "tt0105236", title: "Reservoir Dogs",                            year: "1992" },
  { imdbId: "tt0071853", title: "Monty Python and the Holy Grail",           year: "1975" },
  { imdbId: "tt0095016", title: "Die Hard",                                  year: "1988" },
  { imdbId: "tt0097576", title: "Indiana Jones and the Last Crusade",        year: "1989" },
  { imdbId: "tt0112573", title: "Braveheart",                                year: "1995" },
  { imdbId: "tt0110357", title: "The Lion King",                             year: "1994" },
  { imdbId: "tt0107290", title: "Jurassic Park",                             year: "1993" },
  { imdbId: "tt0266543", title: "Finding Nemo",                              year: "2003" },
  { imdbId: "tt2096673", title: "Inside Out",                                year: "2015" },
  { imdbId: "tt0435761", title: "Toy Story 3",                               year: "2010" },
  { imdbId: "tt0167404", title: "The Sixth Sense",                           year: "1999" },
  { imdbId: "tt0118715", title: "The Big Lebowski",                          year: "1998" },
  { imdbId: "tt0372784", title: "Batman Begins",                             year: "2005" },
  { imdbId: "tt1160419", title: "Dune: Part One",                            year: "2021" },
  { imdbId: "tt0052357", title: "Vertigo",                                   year: "1958" },
  { imdbId: "tt0073195", title: "Jaws",                                      year: "1975" },
  { imdbId: "tt1853728", title: "Django Unchained",                          year: "2012" },
  { imdbId: "tt0092005", title: "Stand by Me",                               year: "1986" },
  { imdbId: "tt0101414", title: "Beauty and the Beast",                      year: "1991" },
  { imdbId: "tt1285016", title: "The Social Network",                        year: "2010" },
  { imdbId: "tt1130884", title: "Shutter Island",                            year: "2010" },
  { imdbId: "tt0096283", title: "My Neighbor Totoro",                        year: "1988" },
  { imdbId: "tt0119488", title: "L.A. Confidential",                         year: "1997" },
  { imdbId: "tt0118694", title: "In the Mood for Love",                      year: "2000" },
  { imdbId: "tt0097216", title: "When Harry Met Sally…",                     year: "1989" },
  { imdbId: "tt0120735", title: "Lock, Stock and Two Smoking Barrels",       year: "1998" },
  { imdbId: "tt0208092", title: "Snatch",                                    year: "2000" },
  { imdbId: "tt0087332", title: "Ghostbusters",                              year: "1984" },
  { imdbId: "tt1185836", title: "The Grand Budapest Hotel",                  year: "2014" },
  { imdbId: "tt1270797", title: "Superbad",                                  year: "2007" },
  { imdbId: "tt7131622", title: "Once Upon a Time in Hollywood",             year: "2019" },
  { imdbId: "tt1454468", title: "Knives Out",                                year: "2019" },
  { imdbId: "tt3783958", title: "La La Land",                                year: "2016" },
  { imdbId: "tt0093822", title: "Raising Arizona",                           year: "1987" },
  { imdbId: "tt0088258", title: "Ferris Bueller's Day Off",                  year: "1986" },
  { imdbId: "tt0099674", title: "Home Alone",                                year: "1990" },
  { imdbId: "tt5052448", title: "Get Out",                                   year: "2017" },
  { imdbId: "tt7784604", title: "Hereditary",                                year: "2018" },
  { imdbId: "tt6644200", title: "A Quiet Place",                             year: "2018" },
  { imdbId: "tt1457767", title: "The Conjuring",                             year: "2013" },
  { imdbId: "tt0054215", title: "Psycho",                                    year: "1960" },
  { imdbId: "tt0075314", title: "Taxi Driver",                               year: "1976" },
  { imdbId: "tt0077416", title: "The Deer Hunter",                           year: "1978" },
  { imdbId: "tt0047396", title: "Rear Window",                               year: "1954" },
  { imdbId: "tt0180093", title: "Requiem for a Dream",                       year: "2000" },
  { imdbId: "tt2543164", title: "Arrival",                                   year: "2016" },
  { imdbId: "tt0470752", title: "Ex Machina",                                year: "2014" },
  { imdbId: "tt1182345", title: "Moon",                                      year: "2009" },
  { imdbId: "tt1856101", title: "Blade Runner 2049",                         year: "2017" },
  { imdbId: "tt1136608", title: "District 9",                                year: "2009" },
  { imdbId: "tt1798709", title: "Her",                                       year: "2013" },
  { imdbId: "tt0114746", title: "12 Monkeys",                                year: "1995" },
  { imdbId: "tt0209144", title: "Memento",                                   year: "2000" },
  { imdbId: "tt6710474", title: "Everything Everywhere All at Once",         year: "2022" },
  { imdbId: "tt0338013", title: "Eternal Sunshine of the Spotless Mind",     year: "2004" },
  { imdbId: "tt4975722", title: "Moonlight",                                 year: "2016" },
  { imdbId: "tt1895587", title: "Spotlight",                                 year: "2015" },
  { imdbId: "tt2024544", title: "12 Years a Slave",                          year: "2013" },
  { imdbId: "tt0119822", title: "As Good as It Gets",                        year: "1997" },
  { imdbId: "tt0407304", title: "Pan's Labyrinth",                           year: "2006" },
  { imdbId: "tt0993846", title: "The Wolf of Wall Street",                   year: "2013" },
  { imdbId: "tt1663202", title: "The Revenant",                              year: "2015" },
  { imdbId: "tt1124035", title: "The Hurt Locker",                           year: "2008" },
  { imdbId: "tt0358273", title: "Walk the Line",                             year: "2005" },
  { imdbId: "tt0107818", title: "Philadelphia",                              year: "1993" },
  { imdbId: "tt0041959", title: "All About Eve",                             year: "1950" },
  { imdbId: "tt0025316", title: "It Happened One Night",                     year: "1934" },
  { imdbId: "tt2911666", title: "John Wick",                                 year: "2014" },
  { imdbId: "tt4912910", title: "Mission: Impossible – Fallout",             year: "2018" },
  { imdbId: "tt0848228", title: "The Avengers",                              year: "2012" },
  { imdbId: "tt1843866", title: "Captain America: The Winter Soldier",       year: "2014" },
  { imdbId: "tt0113277", title: "Heat",                                      year: "1995" },
  { imdbId: "tt0071315", title: "Chinatown",                                 year: "1974" },
  { imdbId: "tt0477348", title: "No Country for Old Men",                    year: "2007" },
  { imdbId: "tt0443706", title: "Zodiac",                                    year: "2007" },
  { imdbId: "tt2267998", title: "Gone Girl",                                 year: "2014" },
  { imdbId: "tt3315342", title: "Logan",                                     year: "2017" },
  { imdbId: "tt1570728", title: "Prisoners",                                 year: "2013" },
  { imdbId: "tt3659388", title: "Sicario",                                   year: "2015" },
  { imdbId: "tt0081398", title: "Raging Bull",                               year: "1980" },
  { imdbId: "tt0112641", title: "Casino",                                    year: "1995" },
  { imdbId: "tt0266697", title: "Kill Bill: Vol. 1",                         year: "2003" },
  { imdbId: "tt0162222", title: "Cast Away",                                 year: "2000" },
  { imdbId: "tt0264464", title: "Catch Me If You Can",                       year: "2002" },
  { imdbId: "tt0119698", title: "Princess Mononoke",                        year: "1997" },
  { imdbId: "tt0347149", title: "Howl's Moving Castle",                      year: "2004" },
  { imdbId: "tt0092067", title: "Castle in the Sky",                         year: "1986" },
  { imdbId: "tt0317219", title: "The Incredibles",                           year: "2004" },
  { imdbId: "tt0369271", title: "Ratatouille",                               year: "2007" },
  { imdbId: "tt0198781", title: "Monsters, Inc.",                            year: "2001" },
  { imdbId: "tt2948356", title: "Zootopia",                                  year: "2016" },
  { imdbId: "tt5311514", title: "Soul",                                      year: "2020" },
  { imdbId: "tt0298148", title: "Shrek",                                     year: "2001" },
  { imdbId: "tt6155172", title: "Roma",                                      year: "2018" },
  { imdbId: "tt8772262", title: "Portrait of a Lady on Fire",                year: "2019" },
  { imdbId: "tt0253474", title: "The Pianist",                               year: "2002" },
  { imdbId: "tt1745960", title: "Top Gun: Maverick",                         year: "2022" },
  { imdbId: "tt5013056", title: "Dunkirk",                                   year: "2017" },
  { imdbId: "tt1877830", title: "The Batman",                                year: "2022" },
  { imdbId: "tt10954984", title: "Past Lives",                               year: "2023" },
  { imdbId: "tt11813216", title: "The Banshees of Inisherin",                year: "2022" },
  { imdbId: "tt0088763", title: "Back to the Future",                        year: "1985" },
  { imdbId: "tt0083658", title: "Blade Runner",                              year: "1982" },
  { imdbId: "tt0090605", title: "Aliens",                                    year: "1986" },
  { imdbId: "tt0078748", title: "Alien",                                     year: "1979" },
  { imdbId: "tt0371746", title: "Iron Man",                                  year: "2008" },
  { imdbId: "tt2015381", title: "Guardians of the Galaxy",                   year: "2014" },
  { imdbId: "tt0780504", title: "Drive",                                     year: "2011" },
  { imdbId: "tt2872718", title: "Nightcrawler",                              year: "2014" },
  { imdbId: "tt1950186", title: "Ford v Ferrari",                            year: "2019" },
  { imdbId: "tt0388795", title: "Brokeback Mountain",                        year: "2005" },
  { imdbId: "tt0246578", title: "Donnie Darko",                              year: "2001" },
  { imdbId: "tt2488496", title: "Star Wars: The Force Awakens",              year: "2015" },
  { imdbId: "tt3501632", title: "Thor: Ragnarok",                            year: "2017" },
  { imdbId: "tt10872600", title: "Spider-Man: No Way Home",                  year: "2021" },
  { imdbId: "tt0120338", title: "Titanic",                                   year: "1997" },
  { imdbId: "tt0499549", title: "Avatar",                                    year: "2009" },
  { imdbId: "tt0325980", title: "Pirates of the Caribbean: The Curse of the Black Pearl", year: "2003" },
  { imdbId: "tt0365748", title: "Shaun of the Dead",                         year: "2004" },
  { imdbId: "tt0425112", title: "Hot Fuzz",                                  year: "2007" },
  { imdbId: "tt0446029", title: "Scott Pilgrim vs. the World",               year: "2010" },
  { imdbId: "tt3890160", title: "Baby Driver",                               year: "2017" },
  { imdbId: "tt1790885", title: "Zero Dark Thirty",                          year: "2012" },
  { imdbId: "tt0102685", title: "Point Break",                               year: "1991" },
  { imdbId: "tt0335266", title: "Lost in Translation",                       year: "2003" },
  { imdbId: "tt0289043", title: "28 Days Later",                             year: "2002" },
  { imdbId: "tt0443706", title: "Zodiac",                                    year: "2007" },
  { imdbId: "tt0945513", title: "Source Code",                               year: "2011" },
  { imdbId: "tt0332280", title: "The Notebook",                              year: "2004" },
  { imdbId: "tt5834426", title: "Aftersun",                                  year: "2022" },
  { imdbId: "tt6334354", title: "The Lighthouse",                            year: "2019" },

  // ── Tier 3 · Popular / Entertaining ──────────────────────────────────────
  { imdbId: "tt0120591", title: "Armageddon",                                year: "1998" },
  { imdbId: "tt0116629", title: "Independence Day",                          year: "1996" },
  { imdbId: "tt1228705", title: "Iron Man 2",                                year: "2010" },
  { imdbId: "tt0800369", title: "Thor",                                      year: "2011" },
  { imdbId: "tt2395427", title: "Avengers: Age of Ultron",                   year: "2015" },
  { imdbId: "tt0948470", title: "The Amazing Spider-Man",                    year: "2012" },
  { imdbId: "tt0369610", title: "Jurassic World",                            year: "2015" },
  { imdbId: "tt0120616", title: "The Mummy",                                 year: "1999" },
  { imdbId: "tt0145487", title: "Spider-Man",                                year: "2002" },
  { imdbId: "tt0413300", title: "Spider-Man 2",                              year: "2004" },
  { imdbId: "tt3480822", title: "Black Panther",                             year: "2018" },
  { imdbId: "tt14209916", title: "Saltburn",                                 year: "2023" },
  { imdbId: "tt4016934", title: "The Witch",                                 year: "2015" },
  { imdbId: "tt2674426", title: "It Follows",                                year: "2014" },
  { imdbId: "tt2094766", title: "Brave",                                     year: "2012" },
  { imdbId: "tt2294629", title: "Frozen",                                    year: "2013" },
  { imdbId: "tt0083866", title: "E.T. the Extra-Terrestrial",                year: "1982" },
  { imdbId: "tt0087544", title: "Ghostbusters II",                           year: "1989" },
  { imdbId: "tt0441773", title: "Kung Fu Panda",                             year: "2008" },
  { imdbId: "tt1877830", title: "The Batman",                                year: "2022" },
];

// ── Tier classification ───────────────────────────────────────────────────────
// Tier 1 = Elite (~8.3+) — hard comparisons within a thin rating band
const TIER_1 = new Set([
  "tt0111161","tt0068646","tt0071562","tt0468569","tt0050083","tt0108052",
  "tt0167260","tt0110912","tt0120737","tt0060196","tt1375666","tt0137523",
  "tt0245429","tt0816692","tt0133093","tt0099685","tt0120815","tt0034583",
  "tt0082971","tt0047478","tt0407887","tt2582802","tt0317248","tt0057012",
  "tt0102926","tt0103064","tt0080684","tt0076759","tt0038650","tt0078788",
  "tt0110413","tt0118799","tt0167261","tt0081505","tt0093058","tt0062622",
  "tt0086879","tt0073486","tt0253474","tt6751668","tt4633694","tt1392190",
  "tt8760708","tt2380307","tt15398776","tt0042876","tt0089881","tt0040522",
  "tt0046438","tt1832382","tt0095765","tt0211915","tt1675434","tt0052311",
  "tt0056592","tt0364569","tt1187043","tt0043014","tt0044081","tt0050825",
  "tt0114709","tt0910970","tt1049413","tt0066921","tt15239678","tt7286456",
  "tt4154796","tt4154756","tt0482571","tt0120689","tt0361748","tt0317248",
]);

// Tier 3 = Popular/Fun (~5.5–7.0) — more accessible, wider rating differences
const TIER_3 = new Set([
  "tt0120591","tt0116629","tt1228705","tt0800369","tt2395427","tt0948470",
  "tt0369610","tt0120616","tt0145487","tt0413300","tt3480822","tt14209916",
  "tt4016934","tt2674426","tt2094766","tt2294629","tt0083866","tt0087544",
  "tt0441773",
]);

function getTier(id: string): 1 | 2 | 3 {
  if (TIER_1.has(id)) return 1;
  if (TIER_3.has(id)) return 3;
  return 2;
}

// ── Fisher-Yates shuffle ───────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Deduplicate pool ──────────────────────────────────────────────────────────
function uniquePool(): MovieStub[] {
  const seen = new Set<string>();
  return MOVIE_POOL.filter((m) => {
    if (seen.has(m.imdbId)) return false;
    seen.add(m.imdbId);
    return true;
  });
}

// ── Balanced pairing: both films in a pair share the same tier ────────────────
// Distribution per session: ~35% tier-1, ~45% tier-2, ~20% tier-3
export function pickBalancedPairs(count: number): [MovieStub, MovieStub][] {
  const pool = uniquePool();
  const t1 = shuffle(pool.filter((m) => getTier(m.imdbId) === 1));
  const t2 = shuffle(pool.filter((m) => getTier(m.imdbId) === 2));
  const t3 = shuffle(pool.filter((m) => getTier(m.imdbId) === 3));

  const n1 = Math.max(1, Math.round(count * 0.35));
  const n3 = Math.max(1, Math.round(count * 0.20));
  const n2 = Math.max(1, count - n1 - n3);

  const makePairs = (movies: MovieStub[], n: number): [MovieStub, MovieStub][] => {
    const pairs: [MovieStub, MovieStub][] = [];
    for (let i = 0; i + 1 < movies.length && pairs.length < n; i += 2) {
      pairs.push([movies[i], movies[i + 1]]);
    }
    return pairs;
  };

  return shuffle([
    ...makePairs(t1, n1),
    ...makePairs(t2, n2),
    ...makePairs(t3, n3),
  ]);
}

// ── Legacy: flat random list (used by classic/game mode) ─────────────────────
export function pickRandomMovies(count: number): MovieStub[] {
  return shuffle(uniquePool()).slice(0, Math.min(count, uniquePool().length));
}
