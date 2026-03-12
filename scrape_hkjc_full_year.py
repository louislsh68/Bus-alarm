#!/usr/bin/env python3
import json, datetime, time, sys, re
from openclaw_tools import web_fetch  # placeholder, we'll call via subprocess

def fetch_day(date_str):
    # Use web_fetch tool via exec to get page text (readability mode)
    import subprocess, json as _json
    cmd = ['openclaw', 'tool', 'web_fetch', '--url', f'https://racing.hkjc.com/zh-hk/local/information/localresults?date={date_str}', '--extractMode', 'text', '--maxChars', '200000']
    # Since we cannot import tool directly, fallback to exec wrapper
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[WARN] fetch error {date_str}: {result.stderr}", file=sys.stderr)
        return None
    data = _json.loads(result.stdout)
    return data.get('text')

def parse_day(html):
    tables = re.findall(r"<table[^>]*?>.*?名次.*?</table>", html, re.S)
    races = []
    for idx, tbl in enumerate(tables, start=1):
        race_no = str(idx)
        rows = []
        for tr in re.findall(r"<tr[^>]*?>(.*?)</tr>", tbl, re.S):
            cols = re.findall(r"<t[dh][^>]*?>(.*?)</t[dh]>", tr, re.S)
            cols = [re.sub(r"<.*?>", "", c).strip() for c in cols]
            if len(cols) < 10:
                continue
            try:
                rows.append({
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
                    "win_odds": float(cols[-1]) if cols[-1] and re.match(r'^[0-9]+(\\.[0-9]+)?$', cols[-1]) else None,
                })
            except Exception:
                continue
        races.append({"race_number": race_no, "results": rows})
    return races

def main():
    end = datetime.date.today()
    start = end - datetime.timedelta(days=3)
    all_days = []
    cur = start
    while cur <= end:
        ds = cur.strftime('%d/%m/%Y')
        print(f'Fetching {ds} …')
        html = fetch_day(ds)
        if html:
            day_data = parse_day(html)
            if day_data:
                all_days.append({"date": cur.isoformat(), "races": day_data})
        time.sleep(0.5)
        cur += datetime.timedelta(days=1)
    out='hkjc_full_year.json'
    with open(out,'w',encoding='utf-8') as f:
        json.dump(all_days,f,ensure_ascii=False,indent=2)
    print(f'Done saved {len(all_days)} days to {out}')

if __name__=='__main__':
    main()
