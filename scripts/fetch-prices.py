import json
import time
import os
import requests
from requests import Session
import yfinance as yf
from datetime import datetime, timezone, timedelta

# Define paths
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
DATA_INDEX_PATH = os.path.join(PUBLIC_DIR, "data", "index.json")
OUTPUT_PATH = os.path.join(PUBLIC_DIR, "market-data.json")

def get_unique_tickers():
    print("Reading data index...")
    try:
        with open(DATA_INDEX_PATH, "r", encoding="utf-8") as f:
            index_data = json.load(f)
        
        # Get latest dataset path
        data_path = index_data.get("datasets", [])[0].get("dataPath")
        if not data_path:
            raise ValueError("No dataPath found in index.json")
        
        # the path in index.json starts with /data/...
        full_data_path = os.path.join(PUBLIC_DIR, data_path.lstrip("/"))
        
        print(f"Reading dataset: {full_data_path}")
        with open(full_data_path, "r", encoding="utf-8") as f:
            ksei_data = json.load(f)
        
        # The structure might be a list or a dictionary containing 'rows'
        rows = ksei_data.get("rows", []) if isinstance(ksei_data, dict) else ksei_data
        
        tickers = set()
        for row in rows:
            share_code = row.get("shareCode")
            if share_code:
                tickers.add(share_code.strip())
        
        unique_tickers = list(tickers)
        print(f"Found {len(unique_tickers)} unique tickers.")
        unique_tickers.sort()
        return unique_tickers
    except Exception as e:
        print(f"Error extracting tickers: {e}")
        return []

def fallback_fetch(ticker, session):
    """Fallback fetch using query2.finance.yahoo.com directly"""
    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}.JK"
    try:
        res = session.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
        
        price = meta.get("regularMarketPrice")
        if price is None:
            return None
            
        return {
            "price": price,
            "avgVolume30d": meta.get("regularMarketVolume", 0),
            "marketCap": 0,
            "pe": 0,
            "pb": 0,
            "divYield": 0,
            "sharesOutstanding": 0
        }
    except Exception as e:
        return None

def fetch_prices(tickers):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    session = Session()
    session.headers.update(headers)
    
    results = {}
    failed_tickers = []
    
    batch_size = 50
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i+batch_size]
        print(f"Fetching batch {i//batch_size + 1}/{(len(tickers) + batch_size - 1)//batch_size} (tickers {i} to {i+len(batch)-1})...")
        
        for ticker in batch:
            ticker_jk = f"{ticker}.JK"
            
            def attempt_yfinance():
                ticker_obj = yf.Ticker(ticker_jk, session=session)
                info = ticker_obj.info
                price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
                
                if price is not None:
                    return {
                        "price": price,
                        "avgVolume30d": info.get("averageVolume", 0),
                        "marketCap": info.get("marketCap", 0),
                        "pe": info.get("trailingPE", 0),
                        "pb": info.get("priceToBook", 0),
                        "divYield": info.get("dividendYield", 0) or 0,
                        "sharesOutstanding": info.get("sharesOutstanding", 0)
                    }
                return None
            
            data = None
            try:
                data = attempt_yfinance()
            except Exception as e:
                pass
                
            if data is None:
                print(f"  Warning: {ticker} failed on first attempt. Retrying in 5s...")
                time.sleep(5)
                try:
                    data = attempt_yfinance()
                except Exception as e:
                    pass
            
            if data is None:
                # Fallback to direct requests call
                data = fallback_fetch(ticker, session)
            
            if data is not None:
                results[ticker] = data
            else:
                print(f"  Error: {ticker} failed all attempts.")
                results[ticker] = None
                failed_tickers.append(ticker)
        
        # Delay 2 seconds between batches
        time.sleep(2)
        print(f"  Batch complete. Total saved so far: {len([k for k, v in results.items() if v is not None])}")
        
    return results, failed_tickers

def main():
    start_time = time.time()
    print("--- Start Market Data Fetch ---")
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    tickers = get_unique_tickers()
    if not tickers:
        print("No tickers found. Aborting.")
        return
        
    # We test with a small slice or full depending on need, but in production we want all unique tickers
    prices_data, failed_tickers = fetch_prices(tickers)
    
    # Updated_at timezone format +07:00
    wib_tz = timezone(timedelta(hours=7))
    updated_at = datetime.now(wib_tz).isoformat(timespec='seconds')
    
    output_json = {
        "updated_at": updated_at,
        "data": prices_data
    }
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output_json, f, indent=2)
        
    success_count = len([k for k, v in prices_data.items() if v is not None])
    print("\n--- Summary ---")
    print(f"Total Tickers     : {len(tickers)}")
    print(f"Successful Fetches: {success_count}")
    print(f"Failed Fetches    : {len(failed_tickers)}")
    print(f"Execution Time    : {round(time.time() - start_time, 2)} seconds")
    print(f"Output saved to   : {OUTPUT_PATH}")
    
    if failed_tickers:
        print("\nFailed Tickers List:")
        print(", ".join(failed_tickers))

if __name__ == "__main__":
    main()
