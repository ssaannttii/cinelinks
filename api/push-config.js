// Exposes the public VAPID key to the client so it knows whether push is enabled.
// No key configured -> push is off and the client never prompts.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || null });
};
