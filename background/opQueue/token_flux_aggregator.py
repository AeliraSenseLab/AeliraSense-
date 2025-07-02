import time
from datetime import datetime, timedelta
import requests

RPC_ENDPOINT = httpsapi.mainnet-beta.solana.com
WINDOW_SECONDS = 600   # 10 minutes
SCAN_INTERVAL_SECONDS = 300

def fetch_token_transfers(mint, since_ts)
    url = fhttpspublic-api.solscan.ioaccounttokentxsaccount={mint}&since={since_ts}
    res = requests.get(url)
    data = res.json().get(data, [])
    events = [tx for tx in data if tx.get(err) is None]
    return events

def aggregate_flux(mint)
    now = int(time.time())
    since = now - WINDOW_SECONDS
    events = fetch_token_transfers(mint, since)
    count = len(events)
    volume = sum(int(tx[tokenAmount][amount]) for tx in events)
    return {mint mint, count count, volume volume, timestamp now}

def log_flux(flux)
    ts = datetime.utcfromtimestamp(flux[timestamp]).isoformat()
    print(f[{ts}] Flux for {flux['mint']} {flux['count']} transfers, total {flux['volume']} tokens)

def run_aggregator(mint)
    while True
        try
            flux = aggregate_flux(mint)
            log_flux(flux)
        except Exception as e
            print(f[ERROR] {e})
        time.sleep(SCAN_INTERVAL_SECONDS)

if __name__ == __main__
    # replace with your token mint
    run_aggregator(YourTokenMintAddress)
