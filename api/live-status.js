// Off Pitch Africa — YouTube live-status check.
//
// Returns whether the channel currently has an active live broadcast, and
// if so, the video ID to embed. Uses the same env vars already documented
// in AGENT.md for the (paused) social feed:
//   YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID
//
// IMPORTANT — API quota: YouTube's search.list endpoint (the only way to
// check "is this channel live right now") costs 100 quota units per call,
// against a default free quota of 10,000 units/day — so only ~100 calls/day
// are available by default. This endpoint's response is cached at the edge
// for 15 minutes (Cache-Control below) so that ALL visitors share the same
// check, regardless of how many people have the site open — worst case
// ~96 calls/day, safely under the default quota. Don't lower the cache
// duration without requesting a quota increase from Google Cloud first,
// or the key will start failing once quota is exhausted.
//
// If YOUTUBE_API_KEY isn't set yet (it isn't, as of this session — see
// AGENT.md §10, still paused on Google Cloud's 2FA requirement), this
// endpoint returns { live: false } instead of erroring, so the site just
// behaves as if nothing is live. No visible breakage either way.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=300');

  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID || 'UC9KSYu8ggh9TSEtn8PSYj1A';

  if (!apiKey) {
    res.status(200).json({ live: false });
    return;
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&key=${encodeURIComponent(apiKey)}`;
    const ytRes = await fetch(url);
    if (!ytRes.ok) {
      res.status(200).json({ live: false });
      return;
    }
    const data = await ytRes.json();
    const item = Array.isArray(data.items) ? data.items[0] : null;
    if (item && item.id && item.id.videoId) {
      res.status(200).json({
        live: true,
        videoId: item.id.videoId,
        title: item.snippet && item.snippet.title ? item.snippet.title : 'Live now'
      });
    } else {
      res.status(200).json({ live: false });
    }
  } catch (err) {
    console.error('live-status check failed:', err);
    res.status(200).json({ live: false });
  }
}
