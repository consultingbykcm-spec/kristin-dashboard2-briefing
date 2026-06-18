const https = require('https');
const fs = require('fs');

const TOKEN = process.env.NOTION_TOKEN;
const DB_IDS = {
  ba:       '355e7566e74b815899cfe47f46e04f25',
  pr:       '355e7566e74b814ea9a4e0e5fef2eb12',
  master:   '35ae7566e74b81a09d81cdefac0c90b6',
  lawlit:   '366e7566e74b806da1a9dfc2a70cdd99',
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

function getText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title.map(t => t.plain_text).join('');
  if (prop.type === 'rich_text') return prop.rich_text.map(t => t.plain_text).join('');
  if (prop.type === 'number') return prop.number != null ? String(prop.number) : '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'date') return prop.date?.start || '';
  return '';
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

function parseLawlit(page) {
  const props = page.properties;
  const topic = getText(props['Topic']);
  const task = getText(props['Task']);
  const type = getText(props['Type']);
  const dueDate = getText(props['Due Date']);
  const statusName = (props['Status']?.status?.name || '').toLowerCase();
  const done = statusName === 'done' || statusName === 'complete' || statusName === 'completed';
  const label = [topic, task].filter(Boolean).join(' — ');
  return { text: label || '(untitled)', due: dueDate, type, done };
}

async function queryDB(dbId, isLawlit) {
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
      if (isLawlit) {
        results.push(parseLawlit(page));
      } else {
        results.push({ text: getTitle(page), done: isDone(page) });
      }
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
    data[key] = await queryDB(id, key === 'lawlit');
    console.log(`  -> ${data[key].length} items`);
  }
  fs.writeFileSync('notion-data.json', JSON.stringify(data, null, 2));
  console.log('Done. notion-data.json written.');
}

main().catch(err => { console.error(err); process.exit(1); });
