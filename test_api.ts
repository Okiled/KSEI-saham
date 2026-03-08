import handler from './api/prices.ts';

// We need a tiny Request polyfill or use node 18+ global fetch/Request
async function main() {
  const req = new Request("http://localhost:3000/api/prices?tickers=BBCA,BMRI");
  const res = await handler(req);
  console.log(res.status);
  const data = await res.json();
  console.log(data);
}

main().catch(console.error);
