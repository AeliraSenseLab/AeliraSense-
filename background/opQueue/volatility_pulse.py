import os
import time
import math
from datetime import datetime, timezone
import requests
import statistics
from typing import List, Sequence, Tuple

CHAIN = os.getenv("CHAIN", "solana")
DEX_API = os.getenv("DEX_API", "https://api.dexscreener.com/latest/dex/pairs")
SCAN_INTERVAL_SECONDS = int(os.getenv("SCAN_INTERVAL_SECONDS", "900"))  # default 15 minutes
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "15"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
BACKOFF_SECONDS = float(os.getenv("BACKOFF_SECONDS", "2"))

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def http_get_json(url: str) -> dict:
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            res = requests.get(
                url,
                headers={
                    "accept": "application/json",
                    "user-agent": "market-pulse/1.0",
                },
                timeout=REQUEST_TIMEOUT,
            )
            if res.ok:
                return res.json()
            last_err = RuntimeError(f"HTTP {res.status_code} {res.reason}")
            if res.status_code in (429,) or 500 <= res.status_code < 600:
                time.sleep(BACKOFF_SECONDS * (attempt + 1))
                continue
            break
        except requests.RequestException as e:
            last_err = e
            time.sleep(BACKOFF_SECONDS * (attempt + 1))
    raise last_err if last_err else RuntimeError("Unknown HTTP error")

def parse_ohlcv(raw: Sequence, target_interval: str = "1h", lookback: int = 72) -> List[Tuple[int, float]]:
    """
    Returns list of (ts_ms, close) for the given interval, sorted ascending, limited to lookback points.
    Dexscreener ohlcv entries are arrays like:
    [timestampMs, open, high, low, close, volume, intervalCode]
    """
    out: List[Tuple[int, float]] = []
    for entry in raw or []:
        try:
            interval = entry[6] if len(entry) > 6 else None
            if interval != target_interval:
                continue
            ts = int(entry[0])
            close_val = float(entry[4])
            if math.isfinite(close_val) and ts > 0:
                out.append((ts, close_val))
        except (ValueError, TypeError, IndexError):
            continue
    out.sort(key=lambda x: x[0])
    if lookback and lookback > 0:
        out = out[-lookback:]
    return out

def fetch_ohlcv(pair_address: str, interval: str = "1h", lookback: int = 72) -> List[Tuple[int, float]]:
    url = f"{DEX_API}/{CHAIN}/{pair_address}?include=ohlcv"
    data = http_get_json(url)
    raw = (data or {}).get("pair", {}).get("ohlcv", [])
    return parse_ohlcv(raw, interval, lookback)

def compute_volatility_from_closes(closes: Sequence[float]) -> float:
    """
    Volatility from percent returns (close-to-close), as stdev of returns in %.
    Returns 0.0 when not enough data.
    """
    if len(closes) < 3:
        return 0.0
    rets = []
    for i in range(1, len(closes)):
        prev = closes[i - 1]
        curr = closes[i]
        if prev <= 0:
            continue
        rets.append((curr - prev) / prev * 100.0)
    if len(rets) < 2:
        return 0.0
    return statistics.stdev(rets)

def log_volatility(pair: str, vol_pct: float, points: int) -> None:
    print(f"[{now_iso()}] volatility % for {pair}: {vol_pct:.4f} (n={points})")

def align_sleep(start_ts: float, interval_seconds: int) -> None:
    """
    Sleeps to align the next run to the wall-clock multiple of interval (e.g., every :00, :15, :30, :45)
    """
    elapsed = time.time() - start_ts
    remainder = interval_seconds - (int(start_ts) % interval_seconds)
    delay = remainder if remainder > 0 else interval_seconds
    delay = max(1, delay - int(elapsed))
    time.sleep(delay)

def scan_once(pair_address: str, interval: str = "1h", lookback: int = 72) -> float:
    ohlcv = fetch_ohlcv(pair_address, interval, lookback)
    closes = [c for _, c in ohlcv]
    vol = compute_volatility_from_closes(closes)
    log_volatility(pair_address, vol, len(closes))
    return vol

def run_pulse(pair_addresses: Sequence[str], interval_code: str = "1h", lookback: int = 72) -> None:
    """
    Main loop. Supports multiple pairs, scanned sequentially, once per SCAN_INTERVAL_SECONDS.
    """
    if not pair_addresses:
        raise ValueError("No pair addresses provided")
    while True:
        loop_started = time.time()
        for pair in pair_addresses:
            try:
                scan_once(pair, interval_code, lookback)
            except Exception as e:
                print(f"[{now_iso()}] [ERROR] {pair}: {e}")
        align_sleep(loop_started, SCAN_INTERVAL_SECONDS)

if __name__ == "__main__":
    import sys
    args = [a for a in sys.argv[1:] if a.strip()]
    env_pairs = [p.strip() for p in os.getenv("PAIR_ADDRESSES", "").split(",") if p.strip()]
    pairs = args if args else env_pairs
    if not pairs:
        raise SystemExit("Provide pair addresses as CLI args or set PAIR_ADDRESSES env")
    try:
        run_pulse(pairs)
    except KeyboardInterrupt:
        print(f"\n[{now_iso()}] stopped by user")
