#!/usr/bin/env python3
"""將 hkjc_results_v5.json 轉成 CSV（完整欄位版）"""
import json, csv
from pathlib import Path

input_file = Path(__file__).parent / "hkjc_results_v5.json"
output_file = Path(__file__).parent / "hkjc_results_v5.csv"

data = json.load(open(input_file, encoding="utf-8"))

FIELDS = ["date", "venue", "race_no", "distance", "race_class", "going", "track",
          "position", "horse_no", "horse_name", "horse_code",
          "jockey", "trainer", "act_weight", "decl_weight",
          "draw", "margin", "running_pos", "finish_time", "win_odds"]

rows = []
for day in data:
    date_str = day["date"]
    venue = day["venue"]
    for race in day["races"]:
        race_no = race["race_no"]
        detail = race.get("detail", {})
        distance = detail.get("distance", "")
        race_class = detail.get("race_class", "")
        going = detail.get("going", "")
        track = detail.get("track", "")
        for runner in race["runners"]:
            rows.append({
                "date": date_str,
                "venue": venue,
                "race_no": race_no,
                "distance": distance,
                "race_class": race_class,
                "going": going,
                "track": track,
                "position": runner.get("position", ""),
                "horse_no": runner.get("horse_no", ""),
                "horse_name": runner.get("horse_name", ""),
                "horse_code": runner.get("horse_code", ""),
                "jockey": runner.get("jockey", ""),
                "trainer": runner.get("trainer", ""),
                "act_weight": runner.get("act_weight", ""),
                "decl_weight": runner.get("decl_weight", ""),
                "draw": runner.get("draw", ""),
                "margin": runner.get("margin", ""),
                "running_pos": runner.get("running_pos", ""),
                "finish_time": runner.get("finish_time", ""),
                "win_odds": runner.get("win_odds", ""),
            })

with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)

# 統計
days = len(data)
total_races = sum(len(d["races"]) for d in data)
date_range = f"{data[0]['date']} ~ {data[-1]['date']}" if data else "N/A"
print(f"✅ {days} 日 | {total_races} 場 | {len(rows)} 匹次 | {date_range}")
print(f"   輸出 → {output_file}")
