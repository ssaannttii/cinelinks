const https = require('https');

const ALLOWED_PATHS = [
  /^person\/popular$/,
  /^movie\/popular$/,
  /^person\/\d+$/,
  /^movie\/\d+$/,
  /^tv\/\d+$/,
  /^movie\/\d+\/credits$/,
  /^tv\/\d+\/credits$/,
  /^tv\/\d+\/aggregate_credits$/,
  /^person\/\d+\/combined_credits$/
];

const ALLOWED_QUERY_PARAMS = new Set(['language', 'page']);

function isAllowedPath(path) {
  return typeof path === 'string' && ALLOWED_PATHS.some((rule) => rule.test(path));
}

function buildTmdbParams(queryParams, apiKey) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(queryParams)) {
    if (!ALLOWED_QUERY_PARAMS.has(key)) {
      return { error: 'Unsupported query parameter: ' + key };
    }

    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value === undefined || value === null || value === '') continue;

    if (key === 'language' && !/^[a-z]{2}-[A-Z]{2}$/.test(value)) {
      return { error: 'Invalid language parameter' };
    }

    if (key === 'page') {
      const page = Number.parseInt(value, 10);
      if (!Number.isInteger(page) || page < 1 || page > 500 || String(page) !== value) {
        return { error: 'Invalid page parameter' };
      }
    }

    params.set(key, value);
  }

  params.set('api_key', apiKey);
  return { params };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (apiKey === undefined || apiKey === null || apiKey === '') {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { path, ...queryParams } = req.query;
  if (path === undefined || path === null || path === '') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  if (!isAllowedPath(path)) {
    return res.status(400).json({ error: 'Unsupported TMDB path' });
  }

  const builtParams = buildTmdbParams(queryParams, apiKey);
  if (builtParams.error) {
    return res.status(400).json({ error: builtParams.error });
  }

  const params = builtParams.params;
  const tmdbPath = '/3/' + path + '?' + params;

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.themoviedb.org',
      port: 443,
      path: tmdbPath,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', function(chunk) { data += chunk; });
      response.on('end', function() {
        try {
          const json = JSON.parse(data);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
          }
          res.status(response.statusCode).json(json);
        } catch (e) {
          res.status(500).json({ error: 'Invalid response from TMDB' });
        }
        resolve();
      });
    });

    request.on('error', function(e) {
      res.status(500).json({ error: 'TMDB request failed: ' + e.message });
      resolve();
    });

    request.end();
  });
};
