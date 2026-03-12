#!/usr/bin/env python3
import json, datetime, time, sys, urllib.request, re
from html.parser import HTMLParser

def fetch_results_for(date_str):
    # HKJC result page URL – date format DD/MM/YYYY (e.g., 04/03/2026)
    base = "https://racing.hkjc.com/zh-hk/local/information/localresults"
    params = {"date": date_str}
    try:
        resp = requests.get(base, params=params, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"[WARN] Failed {date_str}: {e}", file=sys.stderr)
        return None
    soup = BeautifulSoup(resp.text, "html.parser")
    # Find the first table that contains a header with "名次"
    table = None
    for tbl in soup.find_all('table'):
        if tbl.find(string=lambda t: t and '名次' in t):
            table = tbl
            break
    if not table:
        print(f"[WARN] No result table found for {date_str}", file=sys.stderr)
        return None
    rows = []
    for tr in table.find_all('tr')[1:]:
        cols = [c.get_text(strip=True) for c in tr.find_all(['td','th'])]
        if not cols or len(cols) < 10:
            continue
        try:
            result = {
                "position": int(cols[0]),
                "horse_no": int(cols[1]),
                "horse_name": cols[2],
                "jockey": cols[3],
                "trainer": cols[4],
                "actual_weight": int(cols[5]) if cols[5] else None,
                "declared_weight": int(cols[6]) if cols[6] else None,
                "draw": int(cols[7]) if cols[7] else None,
                "head_margin": cols[8] if cols[8] else None,
                "finishing_time": cols[9] if len(cols) > 9 else None,
                "win_odds": float(cols[-1]) if cols[-1] and cols[-1].replace('.','',1).isdigit() else None,
            }
        except Exception:
            continue
        rows.append(result)
    return rows

def main():
    end = datetime.date.today()
    start = end - datetime.timedelta(days=365)
    all_results = []
    cur = start
    while cur <= end:
        date_str = cur.strftime('%d/%m/%Y')
        print(f"Fetching {date_str} …")
        day_res = fetch_results_for(date_str)
        if day_res:
            all_results.append({"date": cur.isoformat(), "results": day_res})
        time.sleep(0.5)
        cur += datetime.timedelta(days=1)
    out_path = "hkjc_results_last_year.json"
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"Done – saved {len(all_results)} days to {out_path}")

if __name__ == "__main__":
    main()
