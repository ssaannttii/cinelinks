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

// ── Approximate IMDb ratings ─────────────────────────────────────────────────
// Used ONLY to choose matchups by difficulty (rating gap). The actual winner is
// always decided by the live OMDb rating fetched at reveal time, so an imprecise
// value here can never make a round "wrong" — it only nudges how close the call
// feels. Keep within ~0.2 of the real IMDb score.
const RATING: Record<string, number> = {
  tt0111161: 9.3, tt0068646: 9.2, tt0071562: 9.0, tt0468569: 9.0, tt0050083: 9.0,
  tt0108052: 9.0, tt0167260: 9.0, tt0110912: 8.9, tt0120737: 8.9, tt0060196: 8.8,
  tt1375666: 8.8, tt0137523: 8.8, tt0245429: 8.6, tt0816692: 8.7, tt0133093: 8.7,
  tt0099685: 8.7, tt0120815: 8.6, tt0034583: 8.5, tt0082971: 8.4, tt0047478: 8.6,
  tt0407887: 8.5, tt2582802: 8.5, tt0317248: 8.6, tt0057012: 8.4, tt0102926: 8.6,
  tt0103064: 8.6, tt0080684: 8.7, tt0076759: 8.6, tt0038650: 8.6, tt0078788: 8.5,
  tt0110413: 8.5, tt0118799: 8.6, tt0167261: 8.8, tt0081505: 8.4, tt0093058: 8.3,
  tt0062622: 8.3, tt0086879: 8.4, tt0073486: 8.7, tt0253474: 8.5, tt6751668: 8.5,
  tt4633694: 8.4, tt1392190: 8.1, tt8760708: 8.2, tt2380307: 8.4, tt15398776: 8.3,
  tt0042876: 8.2, tt0089881: 8.2, tt0040522: 8.3, tt0046438: 8.1, tt1832382: 8.3,
  tt0095765: 8.5, tt0211915: 8.3, tt1675434: 8.5, tt0052311: 8.3, tt0056592: 8.3,
  tt0364569: 8.3, tt1187043: 8.4, tt0043014: 8.4, tt0044081: 8.3, tt0050825: 8.4,
  tt0114709: 8.3, tt0910970: 8.4, tt1049413: 8.3, tt0066921: 8.3, tt15239678: 8.5,
  tt7286456: 8.4, tt4154796: 8.4, tt4154756: 8.4, tt0482571: 8.5, tt0120689: 8.6,
  tt0361748: 8.4, tt0109830: 8.8, tt0172495: 8.5, tt1345836: 8.4, tt0120586: 8.5,
  tt0114369: 8.6, tt0116282: 8.1, tt0105236: 8.3, tt0071853: 8.2, tt0095016: 8.2,
  tt0097576: 8.2, tt0112573: 8.3, tt0110357: 8.5, tt0107290: 8.2, tt0266543: 8.2,
  tt2096673: 8.1, tt0435761: 8.3, tt0167404: 8.2, tt0118715: 8.1, tt0372784: 8.2,
  tt1160419: 8.0, tt0052357: 8.3, tt0073195: 8.1, tt1853728: 8.5, tt0092005: 8.1,
  tt0101414: 8.0, tt1285016: 7.8, tt1130884: 8.2, tt0096283: 8.1, tt0119488: 8.2,
  tt0118694: 8.1, tt0097216: 7.7, tt0120735: 8.1, tt0208092: 8.2, tt0087332: 7.8,
  tt1185836: 8.1, tt1270797: 7.6, tt7131622: 7.6, tt1454468: 7.9, tt3783958: 8.0,
  tt0093822: 7.6, tt0088258: 7.8, tt0099674: 7.6, tt5052448: 7.8, tt7784604: 7.3,
  tt6644200: 7.5, tt1457767: 7.5, tt0054215: 8.5, tt0075314: 8.2, tt0077416: 8.1,
  tt0047396: 8.5, tt0180093: 8.3, tt2543164: 7.9, tt0470752: 7.7, tt1182345: 7.8,
  tt1856101: 8.0, tt1136608: 7.9, tt1798709: 8.0, tt0114746: 8.0, tt0209144: 8.4,
  tt6710474: 7.8, tt0338013: 8.3, tt4975722: 7.4, tt1895587: 8.1, tt2024544: 8.1,
  tt0119822: 7.7, tt0407304: 8.2, tt0993846: 8.2, tt1663202: 8.0, tt1124035: 7.5,
  tt0358273: 7.8, tt0107818: 7.7, tt0041959: 8.2, tt0025316: 8.1, tt2911666: 7.4,
  tt4912910: 7.7, tt0848228: 8.0, tt1843866: 7.7, tt0113277: 8.3, tt0071315: 8.2,
  tt0477348: 8.2, tt0443706: 7.7, tt2267998: 8.1, tt3315342: 8.1, tt1570728: 8.2,
  tt3659388: 7.6, tt0081398: 8.2, tt0112641: 8.2, tt0266697: 8.2, tt0162222: 7.8,
  tt0264464: 8.1, tt0119698: 8.3, tt0347149: 8.2, tt0092067: 8.0, tt0317219: 8.0,
  tt0369271: 8.1, tt0198781: 8.1, tt2948356: 8.0, tt5311514: 8.0, tt0298148: 7.9,
  tt6155172: 7.7, tt8772262: 8.1, tt1745960: 8.2, tt5013056: 7.8, tt1877830: 7.8,
  tt10954984: 7.8, tt11813216: 7.7, tt0088763: 8.5, tt0083658: 8.1, tt0090605: 8.4,
  tt0078748: 8.5, tt0371746: 7.9, tt2015381: 8.0, tt0780504: 7.8, tt2872718: 7.8,
  tt1950186: 8.1, tt0388795: 7.7, tt0246578: 8.0, tt2488496: 7.8, tt3501632: 7.9,
  tt10872600: 8.2, tt0120338: 7.9, tt0499549: 7.9, tt0325980: 8.1, tt0365748: 7.9,
  tt0425112: 7.8, tt0446029: 7.5, tt3890160: 7.5, tt1790885: 7.4, tt0102685: 7.3,
  tt0335266: 7.7, tt0289043: 7.6, tt0945513: 7.5, tt0332280: 7.8, tt5834426: 7.6,
  tt6334354: 7.5, tt0120591: 6.7, tt0116629: 7.0, tt1228705: 6.9, tt0800369: 7.0,
  tt2395427: 7.3, tt0948470: 6.9, tt0369610: 6.9, tt0120616: 7.1, tt0145487: 7.4,
  tt0413300: 7.5, tt3480822: 7.3, tt14209916: 7.0, tt4016934: 6.9, tt2674426: 6.8,
  tt2094766: 7.1, tt2294629: 7.4, tt0083866: 7.9, tt0087544: 6.6, tt0441773: 7.6,
};

function ratingOf(id: string): number {
  return RATING[id] ?? 7.5;
}

// ── Seeded RNG (LCG) — deterministic per date ────────────────────────────────
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

// UTC date → integer seed so all timezones share the same daily challenge
export function getDailySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// Day number since launch (2025-04-01 = day 1)
export function getDayNumber(): number {
  const epoch = Date.UTC(2025, 3, 1);
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((todayUTC - epoch) / 86400000) + 1;
}

// ── Shuffles ──────────────────────────────────────────────────────────────────
function shuffleWith<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shuffle<T>(arr: T[]): T[] {
  return shuffleWith(arr, Math.random);
}

// ── Deduplicate pool ──────────────────────────────────────────────────────────
function uniquePool(): MovieStub[] {
  const seen = new Set<string>();
  return MOVIE_POOL.filter((m) => (seen.has(m.imdbId) ? false : (seen.add(m.imdbId), true)));
}

// ── Difficulty-aware pairing by rating gap ────────────────────────────────────
// The game knows every film's rating, so difficulty == how close the two scores
// are. We build a smooth ramp from an obvious gap down to a razor-thin one, and
// for each round pick a partner whose gap is near the round's target — chosen at
// random among the closest few so matchups vary every session.
function pickPartner(
  anchor: MovieStub,
  candidates: MovieStub[],
  target: number,
  rand: () => number
): MovieStub | null {
  const ra = ratingOf(anchor.imdbId);
  const scored = candidates
    .map((m) => ({ m, gap: Math.abs(ratingOf(m.imdbId) - ra) }))
    .filter((x) => x.gap >= 0.1) // avoid exact ties as the intended answer
    .sort((a, b) => Math.abs(a.gap - target) - Math.abs(b.gap - target));
  if (!scored.length) return null;
  const k = Math.min(8, scored.length);
  return scored[Math.floor(rand() * k)].m;
}

function buildPairs(
  count: number,
  rand: () => number,
  exclude?: Set<string>
): [MovieStub, MovieStub][] {
  let pool = uniquePool();
  if (exclude && exclude.size) {
    const fresh = pool.filter((m) => !exclude.has(m.imdbId));
    if (fresh.length >= count * 2 + 6) pool = fresh; // only honor it if enough remain
  }
  const order = shuffleWith(pool, rand);
  const used = new Set<string>();
  const pairs: [MovieStub, MovieStub][] = [];
  const EASY = 1.6, HARD = 0.25;

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const target = EASY - t * (EASY - HARD); // ramp: obvious → close call
    const anchor = order.find((m) => !used.has(m.imdbId));
    if (!anchor) break;
    used.add(anchor.imdbId);
    const partner = pickPartner(anchor, order.filter((m) => !used.has(m.imdbId)), target, rand);
    if (!partner) { used.delete(anchor.imdbId); continue; }
    used.add(partner.imdbId);
    pairs.push(rand() < 0.5 ? [anchor, partner] : [partner, anchor]);
  }
  return pairs;
}

// Practice: fresh, difficulty-ramped matchups. `exclude` skips recently-seen films.
export function pickBalancedPairs(count: number, exclude?: Set<string>): [MovieStub, MovieStub][] {
  return buildPairs(count, Math.random, exclude);
}

// Daily: same difficulty-ramped set for everyone on a given UTC day.
export function getDailyPairs(count: number): [MovieStub, MovieStub][] {
  return buildPairs(count, seededRng(getDailySeed()));
}

// ── Legacy: flat random list (classic/game mode) ─────────────────────────────
export function pickRandomMovies(count: number): MovieStub[] {
  const pool = uniquePool();
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}
