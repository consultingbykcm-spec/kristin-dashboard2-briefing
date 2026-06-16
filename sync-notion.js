const https = require('https');
const fs = require('fs');

const TOKEN = process.env.NOTION_TOKEN;
const DB_IDS = {
  ba:       '355e7566e74b815899cfe47f46e04f25',
  pr:       '355e7566e74b814ea9a4e0e5fef2eb12',
  master:   '35ae7566e74b81a09d81cdefac0c90b6',
  lawlit:   '345e7566e74b80fdacafcb8defb9171d',
  directed: 'd04599a832c0455fbfc4599bb226229d',
};

function notionRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.notion.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getTitle(page) {
  const props = page.properties;
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p.type === 'title' && p.title && p.title.length > 0) {
      return p.title.map(t => t.plain_text).join('');
    }
  }
  return '(untitled)';
}

function isDone(page) {
  const props = page.properties;
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p.type === 'checkbox') return p.checkbox === true;
    if (p.type === 'status') {
      const s = (p.status?.name || '').toLowerCase();
      return s === 'done' || s === 'complete' || s === 'completed';
    }
  }
  return false;
}

async function queryDB(dbId) {
  const results = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest(`/v1/databases/${dbId}/query`, body);
    if (res.object === 'error') {
      console.error('Notion error for', dbId, res.message);
      return [];
    }
    for (const page of (res.results || [])) {
      results.push({ text: getTitle(page), done: isDone(page) });
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function main() {
  console.log('Syncing Notion tasks...');
  const data = {};
  for (const [key, id] of Object.entries(DB_IDS)) {
    console.log(`  Fetching ${key}...`);
    data[key] = await queryDB(id);
    console.log(`  -> ${data[key].length} items`);
  }
  fs.writeFileSync('notion-data.json', JSON.stringify(data, null, 2));
  console.log('Done. notion-data.json written.');
}

main().catch(err => { console.error(err); process.exit(1); });
