import { readFileSync } from 'fs';
try {
  const env = readFileSync('/home/ubuntu/kjhstock/.env', 'utf8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch {}

const baseUrl = process.env.BUILT_IN_FORGE_API_URL || '';
const apiKey = process.env.BUILT_IN_FORGE_API_KEY || '';
const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').toString();

async function testQuery(label, query) {
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'connect-protocol-version': '1', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ apiId: 'YahooFinance/get_stock_chart', query }),
  });
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    const data = json.jsonData ? JSON.parse(json.jsonData) : json;
    const ts = data?.chart?.result?.[0]?.timestamp;
    console.log(`[${label}] candles: ${ts?.length ?? 0}, status: ${response.status}`);
    if (ts?.length > 0) {
      console.log(`  first: ${new Date(ts[0] * 1000).toISOString().slice(0, 10)}, last: ${new Date(ts[ts.length-1] * 1000).toISOString().slice(0, 10)}`);
    }
  } catch {
    console.log(`[${label}] parse error`);
  }
}

await testQuery('range=1y', { symbol: '005930.KS', region: 'KR', interval: '1d', range: '1y' });
await testQuery('range=2y', { symbol: '005930.KS', region: 'KR', interval: '1d', range: '2y' });
await testQuery('range=5y', { symbol: '005930.KS', region: 'KR', interval: '1d', range: '5y' });
await testQuery('range=max', { symbol: '005930.KS', region: 'KR', interval: '1d', range: 'max' });
