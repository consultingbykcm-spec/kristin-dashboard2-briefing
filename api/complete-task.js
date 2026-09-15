export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pageId, completed } = req.body;
  if (!pageId) return res.status(400).json({ error: 'pageId required' });

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN not configured' });

  const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        Completed: { checkbox: completed === true }
      }
    })
  });

  if (!r.ok) {
    const err = await r.json();
    return res.status(r.status).json({ error: err.message || 'Notion API error' });
  }

  return res.status(200).json({ ok: true });
}
