#!/usr/bin/env python3
"""將 hkjc_results.json 轉成 CSV"""
import json, csv, sys
from pathlib import Path

input_file = Path(__file__).parent / "hkjc_results.json"
output_file = Path(__file__).parent / "hkjc_results.csv"

data = json.load(open(input_file, encoding="utf-8"))

rows = []
for day in data:
    date = day["date"]
    venue = day["venue"]
    for race in day["races"]:
        race_no = race["race_no"]
        for runner in race["runners"]:
            rows.append({
                "date": date,
                "venue": venue,
                "race_no": race_no,
                "position": runner.get("position", ""),
                "horse_no": runner.get("horse_no", ""),
                "horse_name": runner.get("horse_name", ""),
                "jockey": runner.get("jockey", ""),
                "trainer": runner.get("trainer", ""),
                "weight": runner.get("weight", ""),
                "draw": runner.get("draw", ""),
            })

with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["date","venue","race_no","position","horse_no","horse_name","jockey","trainer","weight","draw"])
    writer.writeheader()
    writer.writerows(rows)

print(f"✅ 輸出 {len(rows)} 行 → {output_file}")
