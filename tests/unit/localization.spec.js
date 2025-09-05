const fs = require('fs');
const path = require('path');

const locDir = path.join(__dirname, '../../localize');
const files = fs.readdirSync(locDir).filter(f => f.endsWith('.json'));

function load(f){ return JSON.parse(fs.readFileSync(path.join(locDir,f),'utf8')); }

// Use English as reference
const reference = load('en.json');

function flatten(obj, prefix=''){ return Object.entries(obj).reduce((acc,[k,v]) => {
  const p = prefix ? prefix + '.' + k : k;
  if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flatten(v,p)); else acc[p]=true; return acc;
}, {}); }

const refKeys = Object.keys(flatten(reference));

describe('localization completeness', () => {
  for (const f of files) {
    if (f === 'en.json') continue;
    it(`${f} has no missing keys`, () => {
      const cur = load(f);
      const curKeys = Object.keys(flatten(cur));
      const missing = refKeys.filter(k => !curKeys.includes(k));
      expect(missing).toEqual([]);
    });
  }
});
