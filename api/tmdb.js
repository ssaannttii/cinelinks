const https = require('https');

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

  const params = new URLSearchParams({ ...queryParams, api_key: apiKey });
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
