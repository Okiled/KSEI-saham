import { handlePricesRequest } from "./_lib/prices-service";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const result = await handlePricesRequest(req.query?.tickers);

  for (const [header, value] of Object.entries(result.headers)) {
    res.setHeader(header, value);
  }

  res.status(result.status).send(JSON.stringify(result.payload));
}
