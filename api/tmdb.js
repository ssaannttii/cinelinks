export default async function handler(req, res) {
  // Allow CORS from same origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (\!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Forward the path and query params to TMDB
  const { path, ...queryParams } = req.query;
  if (\!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // Build TMDB URL with all query params + api_key
  const tmdbParams = new URLSearchParams({ ...queryParams, api_key: apiKey });
  const tmdbUrl = `https://api.themoviedb.org/3/${path}?${tmdbParams}`;

  try {
    const response = await fetch(tmdbUrl);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from TMDB' });
  }
}
