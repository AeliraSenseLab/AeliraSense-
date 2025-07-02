import time
from datetime import datetime
from solana.rpc.api import Client

RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"
SCAN_INTERVAL_SECONDS = 300   # 5 minutes
WHALE_THRESHOLD = 10_000      # base units

client = Client(RPC_ENDPOINT)


def fetch_whale_movements(limit=100):
    sigs = client.get_signatures_for_address(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        limit=limit
    )["result"]

    whales = []
    for info in sigs:
        tx = client.get_parsed_confirmed_transaction(info["signature"])["result"]
        if not tx or not tx.get("meta"):
            continue

        for instr in tx["transaction"]["message"]["instructions"]:
            parsed = instr.get("parsed", {})
            if parsed.get("type") == "transfer":
                amt = int(parsed["info"]["amount"])
                if amt >= WHALE_THRESHOLD:
                    whales.append({
                        "signature": info["signature"],
                        "mint": parsed["info"]["mint"],
                        "amount": amt,
                        "source": parsed["info"]["source"],
                        "dest": parsed["info"]["destination"],
                        "time": tx.get("blockTime")
                    })
    return whales


def log_whales(whales):
    print(f"[{datetime.utcnow().isoformat()}] Whale movements: {len(whales)}")
    for w in whales:
        t = datetime.utcfromtimestamp(w["time"]).isoformat() if w["time"] else "unknown"
        print(f" • {w['amount']} of {w['mint']} from {w['source']} → {w['dest']} at {t} ({w['signature']})")


def run_watcher():
    while True:
        try:
            whales = fetch_whale_movements()
            if whales:
                log_whales(whales)
            else:
                print(f"[{datetime.utcnow().isoformat()}] No whale moves.")
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(SCAN_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_watcher()
