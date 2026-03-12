#!/usr/bin/env python3
"""
HKJC 賽馬日即時分析腳本
- 自動抓取當日排位 + 賠率（GraphQL API）
- 結合歷史資料做 Value Bet 分析
- 自動發送報告到 Telegram

用法:
  python3 hkjc_race_day_analysis.py                 # 分析今日賽事
  python3 hkjc_race_day_analysis.py 2026-03-15      # 指定日期
  python3 hkjc_race_day_analysis.py --race 1        # 只分析第1場
  python3 hkjc_race_day_analysis.py --all            # 全部場次
"""

import json, subprocess, sys, argparse, warnings, os
import numpy as np
import pandas as pd
from datetime import date
from pathlib import Path

warnings.filterwarnings("ignore")

WORKSPACE = Path(__file__).parent
HISTORY_FILE = WORKSPACE / "hkjc_results_v5.json"
JS_FETCHER = Path("/tmp/hkjc_test/get_race_day.mjs")
TELEGRAM_TARGET = "118380703"

# ══════════════════════════════════════════════
# 1. 抓取賽事資料
# ══════════════════════════════════════════════
def fetch_race_day(race_date: str) -> dict:
    print(f"📡 抓取 {race_date} 賽事資料...")
    result = subprocess.run(
        ["node", str(JS_FETCHER), race_date],
        capture_output=True, text=True, cwd=str(JS_FETCHER.parent)
    )
    if result.returncode != 0:
        print(f"❌ 抓取失敗: {result.stderr[:200]}")
        sys.exit(1)
    data = json.loads(result.stdout)
    print(f"✅ {data['date']} {data['venue']} | {data['totalRaces']}場 | 狀態: {data['status']}")
    return data


# ══════════════════════════════════════════════
# 2. 載入歷史資料 & 建立統計
# ══════════════════════════════════════════════
def load_history() -> pd.DataFrame:
    data = json.load(open(HISTORY_FILE, encoding="utf-8"))
    rows = []
    for day in data:
        for race in day["races"]:
            for r in race["runners"]:
                try: pos = int(str(r["position"]))
                except: pos = 99
                try: odds = float(str(r.get("win_odds") or 0))
                except: odds = 0
                try: draw = int(str(r.get("draw") or 0))
                except: draw = 0
                rows.append({
                    "date": day["date"], "venue": day["venue"],
                    "pos": pos, "won": int(pos==1), "top3": int(pos<=3),
                    "jockey": r.get("jockey",""),
                    "trainer": r.get("trainer",""),
                    "draw": draw, "odds": odds,
                    "horse_code": r.get("horse_code",""),
                })
    df = pd.DataFrame(rows)
    df_ran = df[df.pos < 20]
    return df_ran


def build_stats(df: pd.DataFrame, venue: str) -> dict:
    j_stats = df.groupby("jockey").agg(
        rides=("won","count"), win_rate=("won","mean"), top3_rate=("top3","mean")
    ).reset_index()
    t_stats = df.groupby("trainer").agg(
        rides=("won","count"), win_rate=("won","mean"), top3_rate=("top3","mean")
    ).reset_index()
    combo = df.groupby(["jockey","trainer"]).agg(
        count=("won","count"), win_rate=("won","mean"), top3_rate=("top3","mean")
    ).reset_index()
    draw_stats = df[df.venue==venue].groupby("draw").agg(
        count=("won","count"), win_rate=("won","mean"), top3_rate=("top3","mean")
    ).reset_index().set_index("draw")
    return {"jockey": j_stats, "trainer": t_stats, "combo": combo, "draw": draw_stats}


# ══════════════════════════════════════════════
# 3. 單場分析
# ══════════════════════════════════════════════
def analyse_race(race: dict, stats: dict, venue: str) -> list:
    j_stats = stats["jockey"]
    t_stats = stats["trainer"]
    combo   = stats["combo"]
    draw_st = stats["draw"]

    def fmt(v): return f"{v:.1%}" if (v is not None and not np.isnan(float(v))) else "N/A"
    def get_odds(v):
        try: return float(v) if v and str(v) not in ('N/A','') else np.nan
        except: return np.nan

    results = []
    for h in race["runners"]:
        if h.get("status") not in (None, "", "Declared", "Scratched", "Active", "Standby"):
            continue
        if h.get("status") == "Scratched":
            continue

        j = h.get("jockey_ch","")
        t = h.get("trainer_ch","")
        try: d = int(str(h.get("draw") or 0))
        except: d = 0

        win_odds = get_odds(h.get("win_odds"))
        market_prob = 1/win_odds if not np.isnan(win_odds) and win_odds > 0 else np.nan

        # 歷史統計
        jrow = j_stats[j_stats.jockey==j]
        j_wr = jrow.win_rate.values[0] if len(jrow) and jrow.rides.values[0]>=10 else np.nan
        j_t3 = jrow.top3_rate.values[0] if len(jrow) and jrow.rides.values[0]>=10 else np.nan

        trow = t_stats[t_stats.trainer==t]
        t_wr = trow.win_rate.values[0] if len(trow) and trow.rides.values[0]>=10 else np.nan

        crow = combo[(combo.jockey==j)&(combo.trainer==t)]
        c_wr = crow.win_rate.values[0] if len(crow) and crow["count"].values[0]>=5 else np.nan
        c_cnt = int(crow["count"].values[0]) if len(crow) else 0

        d_wr = draw_st.loc[d]["win_rate"] if d in draw_st.index else np.nan

        # 綜合評分
        parts, wts = [], []
        for v,w in [(j_wr,0.40),(t_wr,0.20),(c_wr,0.20),(d_wr,0.20)]:
            if v is not None and not np.isnan(float(v)):
                parts.append(float(v)*w); wts.append(w)
        score = sum(parts)/sum(wts)*sum(wts) if wts else 0

        results.append({
            "no": h["no"], "name": h["name_ch"],
            "jockey": j, "trainer": t, "draw": d,
            "weight": h.get("weight",""),
            "win_odds": win_odds, "market_prob": market_prob,
            "j_wr": j_wr, "j_t3": j_t3,
            "t_wr": t_wr, "c_wr": c_wr, "c_cnt": c_cnt, "d_wr": d_wr,
            "score": score,
        })

    return results


# ══════════════════════════════════════════════
# 4. 格式化報告
# ══════════════════════════════════════════════
def format_race_report(race: dict, runners: list, venue: str) -> str:
    def fmt(v):
        if v is None: return "N/A"
        try:
            f = float(v)
            return f"{f:.1%}" if not np.isnan(f) else "N/A"
        except: return "N/A"

    lines = []
    r_no = race["no"]
    r_name = race.get("name_ch","")
    r_dist = race.get("distance","")
    r_class = race.get("class_ch","")
    r_track = race.get("track","")
    post = race.get("postTime","")
    if post: post = post[11:16]  # HH:MM

    lines.append(f"\n{'─'*55}")
    lines.append(f"🏁 第{r_no}場  {r_name}  {r_dist}米  {r_class}")
    lines.append(f"   跑道: {r_track}  開跑: {post}  {venue}")
    lines.append(f"{'─'*55}")

    # 按評分排序
    sorted_r = sorted(runners, key=lambda x: -x["score"])

    # 有賠率：做 Value Bet 分析
    has_odds = any(not np.isnan(r["win_odds"]) for r in runners if r["win_odds"] is not None)

    # normalize 評分為概率
    total_score = sum(r["score"] for r in sorted_r if r["score"] > 0)
    for r in sorted_r:
        r["model_prob"] = r["score"]/total_score if total_score > 0 else 0

    if has_odds:
        # normalize market prob
        total_mp = sum(r["market_prob"] for r in sorted_r if r["market_prob"] and not np.isnan(r["market_prob"]))
        for r in sorted_r:
            r["market_prob_norm"] = r["market_prob"]/total_mp if (r["market_prob"] and not np.isnan(r["market_prob"]) and total_mp>0) else 0
            r["value_ratio"] = r["model_prob"]/r["market_prob_norm"] if r.get("market_prob_norm",0) > 0 else 0

        lines.append(f"  {'馬':>2} {'馬名':<10} {'騎師':<7} {'賠率':>5} {'市場%':>6} {'模型%':>6} {'Value':>6}  {'名次預測'}")
        lines.append("  " + "─"*60)
        medals = ["🥇","🥈","🥉","4️⃣","5️⃣"]
        for i, r in enumerate(sorted_r[:8]):
            medal = medals[i] if i < 5 else f"{i+1}."
            odds_str = f"{r['win_odds']:.1f}" if r["win_odds"] and not np.isnan(r["win_odds"]) else " N/A"
            mp_str = fmt(r.get("market_prob_norm"))
            vr = r.get("value_ratio",0)
            value_str = f"{vr:.2f}x" if vr > 0 else "  N/A"
            value_flag = " ⚡VALUE" if vr > 1.3 else ""
            lines.append(f"  {medal} {r['no']:>2} {r['name']:<10} {r['jockey']:<7} {odds_str:>5} {mp_str:>6} {fmt(r['model_prob']):>6} {value_str:>6}{value_flag}")

        # Value Bets 總結
        value_bets = [r for r in sorted_r if r.get("value_ratio",0) > 1.3]
        if value_bets:
            lines.append(f"\n  ⚡ VALUE BET: " + " | ".join(
                f"馬{r['no']} {r['name']}(@{r['win_odds']:.1f}倍)" for r in value_bets[:3]
            ))
    else:
        # 無賠率：只顯示評分排名
        lines.append(f"  {'馬':>2} {'馬名':<10} {'騎師':<7} {'練馬師':<7} {'檔':>3} {'磅':>4} │ 騎師%  師%  組合%  檔%")
        lines.append("  " + "─"*65)
        medals = ["🥇","🥈","🥉","4 ","5 "]
        for i, r in enumerate(sorted_r[:8]):
            medal = medals[i] if i < 5 else f"{i+1}."
            c_str = f"{fmt(r['c_wr'])}({r['c_cnt']})" if r["c_cnt"]>=5 else "   N/A"
            lines.append(f"  {medal} {r['no']:>2} {r['name']:<10} {r['jockey']:<7} {r['trainer']:<7} "
                        f"{r['draw']:>3} {str(r['weight']):>4} │ "
                        f"{fmt(r['j_wr'])} {fmt(r['t_wr'])} {c_str:>9} {fmt(r['d_wr'])}")

        lines.append(f"\n  📌 等賠率出咗再發送 Value Bet 分析")

    return "\n".join(lines)


# ══════════════════════════════════════════════
# 5. 發送 Telegram
# ══════════════════════════════════════════════
def send_telegram(message: str):
    """用 openclaw CLI 發送 Telegram"""
    try:
        result = subprocess.run(
            ["openclaw", "send", "--channel", "telegram", "--to", TELEGRAM_TARGET, "--message", message],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print("📨 已發送到 Telegram")
        else:
            print(f"⚠️  Telegram 發送失敗: {result.stderr[:100]}")
    except Exception as e:
        print(f"⚠️  Telegram 發送錯誤: {e}")


# ══════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="HKJC 賽馬日即時分析")
    parser.add_argument("date", nargs="?", default=date.today().isoformat(), help="賽事日期 YYYY-MM-DD")
    parser.add_argument("--race", type=int, default=0, help="指定場次 (0=全部)")
    parser.add_argument("--no-send", action="store_true", help="不發送 Telegram")
    args = parser.parse_args()

    # 抓取資料
    day_data = fetch_race_day(args.date)
    venue = day_data["venue"]

    # 載入歷史統計
    print("📊 載入歷史資料...")
    df_hist = load_history()
    stats = build_stats(df_hist, venue)

    # 決定分析哪些場次
    races = day_data["races"]
    if args.race > 0:
        races = [r for r in races if int(r["no"]) == args.race]

    # 建立報告
    header = (
        f"🏇 HKJC 賽馬分析報告\n"
        f"📅 {day_data['date']} | {venue} | {day_data['totalRaces']}場\n"
        f"狀態: {day_data['status']}"
    )
    print("\n" + header)

    full_report = header
    for race in races:
        runners = analyse_race(race, stats, venue)
        if not runners:
            continue
        report = format_race_report(race, runners, venue)
        print(report)
        full_report += "\n" + report

    # 發送 Telegram
    if not args.no_send:
        # 分段發送（Telegram 有字數限制）
        chunks = [full_report[i:i+4000] for i in range(0, len(full_report), 4000)]
        for chunk in chunks:
            send_telegram(chunk)

    print("\n✅ 分析完成！")


if __name__ == "__main__":
    main()
