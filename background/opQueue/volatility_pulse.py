import time
from datetime import datetime
import requests
import statistics

CHAIN = "solana"
SCAN_INTERVAL_SECONDS = 900   # 15 minutes
DEX_API = "https://api.dexscreener.com/latest/dex/pairs"

def fetch_ohlcv(pair_address):
    url = f"{DEX_API}/{CHAIN}/{pair_address}?include=ohlcv"
    res = requests.get(url)
    raw = res.json().get("pair", {}).get("ohlcv", [])
    return [entry for entry in raw if entry[6] == "1h"]  # filter 1h candles

def compute_volatility(closes):
    prices = [float(c[4]) for c in closes]
    if len(prices) < 2:
        return 0.0
    return statistics.stdev(prices) / statistics.mean(prices) * 100

def log_volatility(pair, vol_pct):
    ts = datetime.utcnow().isoformat()
    print(f"[{ts}] Volatility for {pair}: {vol_pct:.2f}%")

def run_pulse(pair_address):
    while True:
        try:
            ohlcv = fetch_ohlcv(pair_address)
            vol = compute_volatility(ohlcv)
            log_volatility(pair_address, vol)
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(SCAN_INTERVAL_SECONDS)

if __name__ == "__main__":
    # replace with your pair address
    run_pulse("YourPairAddressHere")
