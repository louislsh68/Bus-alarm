#!/usr/bin/env python3
"""HKJC 賽馬資料 EDA + 關聯分析"""
import json, warnings
import numpy as np
import pandas as pd
from pathlib import Path
from collections import defaultdict

warnings.filterwarnings("ignore")

DATA_FILE = Path(__file__).parent / "hkjc_results_v5.json"

# ══════════════════════════════════════════════
# 載入資料
# ══════════════════════════════════════════════
data = json.load(open(DATA_FILE, encoding="utf-8"))
rows = []
for day in data:
    for race in day["races"]:
        detail = race.get("detail", {})
        dist_raw = detail.get("distance", "")
        dist = int("".join(filter(str.isdigit, dist_raw))) if dist_raw else 0
        for r in race["runners"]:
            try: pos = int(r["position"])
            except: pos = 99
            try: odds = float(r.get("win_odds") or 0)
            except: odds = 0
            try: draw = int(r.get("draw") or 0)
            except: draw = 0
            try: wt = int(r.get("act_weight") or 0)
            except: wt = 0
            rp = r.get("running_pos", "")
            rp_list = [int(x) for x in rp.split() if x.isdigit()]
            rows.append({
                "date": day["date"], "venue": day["venue"],
                "race_no": race["race_no"], "distance": dist,
                "race_class": detail.get("race_class",""),
                "going": detail.get("going",""),
                "field_size": len(race["runners"]),
                "pos": pos, "won": int(pos==1), "top3": int(pos<=3),
                "horse_code": r.get("horse_code",""),
                "horse_name": r.get("horse_name",""),
                "jockey": r.get("jockey",""),
                "trainer": r.get("trainer",""),
                "draw": draw, "act_weight": wt, "odds": odds,
                "market_prob": 1/odds if odds>0 else np.nan,
                "run_pos_count": len(rp_list),
                "final_run_pos": rp_list[-1] if rp_list else np.nan,
            })

df = pd.DataFrame(rows)
df["date"] = pd.to_datetime(df["date"])
df["race_id"] = df["date"].dt.date.astype(str) + "_R" + df["race_no"].astype(str)

# 只取有效完賽記錄（排除退出等）
df_ran = df[df["pos"] < 20].copy()
df_won = df_ran[df_ran["won"]==1].copy()

print("="*60)
print("📊 HKJC 賽馬資料 EDA 報告")
print("="*60)
print(f"總記錄: {len(df_ran):,} 匹次 | 場次: {df_ran['race_id'].nunique()} | 賽馬日: {df['date'].nunique()}")
print(f"日期: {df['date'].min().date()} ~ {df['date'].max().date()}")
print(f"場地: HV={df[df.venue=='HV']['date'].nunique()}日, ST={df[df.venue=='ST']['date'].nunique()}日")

# ══════════════════════════════════════════════
# 1. 場地 × 距離分佈
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("📍 1. 場地 × 距離分佈")
print("─"*60)
dist_venue = df_ran.groupby(["venue","distance"]).size().reset_index(name="count")
for venue in ["HV","ST"]:
    vdf = dist_venue[dist_venue.venue==venue].sort_values("distance")
    dists = ", ".join(f"{r.distance}米({r['count']}場)" for _,r in vdf.iterrows())
    print(f"  {venue}: {dists}")

# ══════════════════════════════════════════════
# 2. 大熱門勝率分析
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("🔥 2. 大熱門（最低賠率）勝率")
print("─"*60)
fav = df_ran.copy()
fav["odds_rank"] = fav.groupby("race_id")["odds"].rank(ascending=True, method="min")
fav1 = fav[fav["odds_rank"]==1]
fav2 = fav[fav["odds_rank"]==2]
fav3 = fav[fav["odds_rank"]==3]
print(f"  1大熱 勝率: {fav1['won'].mean():.1%} | 位置率: {fav1['top3'].mean():.1%} ({len(fav1)}場)")
print(f"  2大熱 勝率: {fav2['won'].mean():.1%} | 位置率: {fav2['top3'].mean():.1%} ({len(fav2)}場)")
print(f"  3大熱 勝率: {fav3['won'].mean():.1%} | 位置率: {fav3['top3'].mean():.1%} ({len(fav3)}場)")

# 按賠率區間
print("\n  賠率區間分析:")
bins = [1,2,3,5,8,13,20,50,200]
labels = ["1-2","2-3","3-5","5-8","8-13","13-20","20-50","50+"]
df_ran["odds_bin"] = pd.cut(df_ran["odds"], bins=bins, labels=labels)
ob = df_ran.groupby("odds_bin", observed=True).agg(
    count=("won","count"), win_rate=("won","mean"), top3_rate=("top3","mean")
).reset_index()
for _, r in ob.iterrows():
    bar = "█" * int(r.win_rate * 100)
    print(f"  {r.odds_bin:>6}倍: 勝率{r.win_rate:>5.1%} {bar}  ({int(r['count'])}匹)")

# ══════════════════════════════════════════════
# 3. 檔位分析
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("🚦 3. 檔位勝率分析")
print("─"*60)
draw_stats = df_ran[df_ran["draw"]>0].groupby("draw").agg(
    count=("won","count"), win_rate=("won","mean"), top3_rate=("top3","mean")
).reset_index()
draw_stats = draw_stats[draw_stats["count"]>=20]

print("  檔位  出賽  勝率   位置率")
for _, r in draw_stats.iterrows():
    bar = "█" * int(r.win_rate * 80)
    print(f"  {int(r.draw):>3}檔  {int(r['count']):>4}  {r.win_rate:>5.1%}  {r.top3_rate:>5.1%}  {bar}")

# 按場地分開
print("\n  HV 檔位 Top 5:")
hv_draw = df_ran[(df_ran.venue=="HV")&(df_ran.draw>0)].groupby("draw").agg(
    count=("won","count"), win_rate=("won","mean")
).reset_index().query("count>=15").sort_values("win_rate",ascending=False)
for _, r in hv_draw.head(5).iterrows():
    print(f"    檔{int(r.draw)}: {r.win_rate:.1%} ({int(r['count'])}場)")

print("  ST 檔位 Top 5:")
st_draw = df_ran[(df_ran.venue=="ST")&(df_ran.draw>0)].groupby("draw").agg(
    count=("won","count"), win_rate=("won","mean")
).reset_index().query("count>=15").sort_values("win_rate",ascending=False)
for _, r in st_draw.head(5).iterrows():
    print(f"    檔{int(r.draw)}: {r.win_rate:.1%} ({int(r['count'])}場)")

# ══════════════════════════════════════════════
# 4. 騎師表現 Top 10
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("🏇 4. 騎師表現 Top 10（最少 30 場）")
print("─"*60)
jstats = df_ran.groupby("jockey").agg(
    rides=("won","count"), wins=("won","sum"),
    win_rate=("won","mean"), top3_rate=("top3","mean"),
    avg_odds=("odds","mean")
).reset_index().query("rides>=30").sort_values("win_rate",ascending=False)
print(f"  {'騎師':<10} {'出賽':>5} {'勝出':>5} {'勝率':>7} {'位置率':>7} {'平均賠率':>8}")
print("  " + "-"*50)
for _, r in jstats.head(10).iterrows():
    print(f"  {r.jockey:<10} {int(r.rides):>5} {int(r.wins):>5} {r.win_rate:>7.1%} {r.top3_rate:>7.1%} {r.avg_odds:>8.1f}")

# ══════════════════════════════════════════════
# 5. 練馬師表現 Top 10
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("🎓 5. 練馬師表現 Top 10（最少 30 場）")
print("─"*60)
tstats = df_ran.groupby("trainer").agg(
    rides=("won","count"), wins=("won","sum"),
    win_rate=("won","mean"), top3_rate=("top3","mean")
).reset_index().query("rides>=30").sort_values("win_rate",ascending=False)
print(f"  {'練馬師':<10} {'出賽':>5} {'勝出':>5} {'勝率':>7} {'位置率':>7}")
print("  " + "-"*40)
for _, r in tstats.head(10).iterrows():
    print(f"  {r.trainer:<10} {int(r.rides):>5} {int(r.wins):>5} {r.win_rate:>7.1%} {r.top3_rate:>7.1%}")

# ══════════════════════════════════════════════
# 6. 騎師×練馬師黃金組合
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("💛 6. 騎師×練馬師黃金組合（最少 10 次合作）")
print("─"*60)
combo = df_ran.groupby(["jockey","trainer"]).agg(
    count=("won","count"), wins=("won","sum"), win_rate=("won","mean")
).reset_index().query("count>=10").sort_values("win_rate",ascending=False)
print(f"  {'騎師':<10} {'練馬師':<10} {'合作':>6} {'勝出':>6} {'勝率':>7}")
print("  " + "-"*45)
for _, r in combo.head(10).iterrows():
    print(f"  {r.jockey:<10} {r.trainer:<10} {int(r['count']):>6} {int(r.wins):>6} {r.win_rate:>7.1%}")

# ══════════════════════════════════════════════
# 7. 場地狀況影響
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("🌧 7. 場地狀況 × 大熱勝率")
print("─"*60)
fav_all = df_ran.copy()
fav_all["odds_rank"] = fav_all.groupby("race_id")["odds"].rank(ascending=True, method="min")
going_fav = fav_all[fav_all["odds_rank"]==1].groupby("going").agg(
    races=("won","count"), win_rate=("won","mean")
).reset_index().query("races>=10").sort_values("win_rate",ascending=False)
for _, r in going_fav.iterrows():
    print(f"  {r.going or '(未知)':<8}: 大熱勝率 {r.win_rate:.1%} ({int(r.races)}場)")

# ══════════════════════════════════════════════
# 8. 市場效率分析（賠率 vs 實際勝率）
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("📈 8. 市場效率：賠率隱含概率 vs 實際勝率")
print("─"*60)
df_odds = df_ran[df_ran["odds"]>0].copy()
df_odds["implied"] = 1 / df_odds["odds"]
bins_p = [0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.60, 1.0]
labels_p = ["<5%","5-10%","10-15%","15-20%","20-30%","30-40%","40-60%",">60%"]
df_odds["prob_bin"] = pd.cut(df_odds["implied"], bins=bins_p, labels=labels_p)
market_eff = df_odds.groupby("prob_bin", observed=True).agg(
    count=("won","count"), actual_win=("won","mean"), avg_implied=("implied","mean")
).reset_index()
print(f"  {'賠率隱含%':<10} {'出賽':>6} {'隱含勝率':>9} {'實際勝率':>9} {'差距':>8}")
print("  " + "-"*48)
for _, r in market_eff.iterrows():
    diff = r.actual_win - r.avg_implied
    flag = "↑" if diff > 0.02 else ("↓" if diff < -0.02 else "≈")
    print(f"  {str(r.prob_bin):<10} {int(r['count']):>6} {r.avg_implied:>8.1%} {r.actual_win:>8.1%}  {flag}{abs(diff):>5.1%}")

# ══════════════════════════════════════════════
# 9. 負磅影響
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("⚖️  9. 負磅分佈 × 勝率")
print("─"*60)
wt_df = df_ran[df_ran["act_weight"]>100].copy()
wt_df["wt_bin"] = pd.cut(wt_df["act_weight"], bins=[110,118,122,126,130,134,140],
                          labels=["111-118","119-122","123-126","127-130","131-134","135+"])
wt_stats = wt_df.groupby("wt_bin", observed=True).agg(
    count=("won","count"), win_rate=("won","mean")
).reset_index()
for _, r in wt_stats.iterrows():
    bar = "█" * int(r.win_rate * 80)
    print(f"  {str(r.wt_bin):<10}: {r.win_rate:>5.1%}  {bar}  ({int(r['count'])}匹)")

# ══════════════════════════════════════════════
# 10. 最近 form 影響（last_pos）
# ══════════════════════════════════════════════
print("\n" + "─"*60)
print("📋 10. 今場距離 × 勝率")
print("─"*60)
dist_stats = df_ran[df_ran.distance>0].groupby("distance").agg(
    races=("race_id","nunique"), win_count=("won","sum"),
    win_rate=("won","mean"), fav_win=("won","mean")
).reset_index().sort_values("races",ascending=False)
for _, r in dist_stats.iterrows():
    bar = "█" * int(r.win_rate * 80)
    print(f"  {int(r.distance):>5}米: {r.win_rate:>5.1%} ({int(r.races)}場)")

print("\n" + "="*60)
print("✅ EDA 完成！")
print("="*60)
