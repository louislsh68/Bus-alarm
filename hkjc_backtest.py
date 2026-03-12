#!/usr/bin/env python3
"""
HKJC 賽馬 Walk-Forward Backtest
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
逐日滾動訓練，模擬真實下注場景：
- 每次用前 N 日訓練模型
- 預測下一個賽馬日
- 計算各策略 ROI、勝率、最大連輸

使用:
  python3 hkjc_backtest.py
  python3 hkjc_backtest.py --min-train 30   # 最少訓練日數
  python3 hkjc_backtest.py --threshold 1.3  # Value Bet 門檻
  python3 hkjc_backtest.py --stake 10       # 每注金額

安裝:
  pip3 install pandas numpy scikit-learn lightgbm --break-system-packages
"""

import json, argparse, warnings
import numpy as np
import pandas as pd
from pathlib import Path
from collections import defaultdict
from datetime import datetime

warnings.filterwarnings("ignore")

try:
    import lightgbm as lgb
    from sklearn.metrics import roc_auc_score
    from sklearn.preprocessing import LabelEncoder
except ImportError:
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "pip", "install",
                    "pandas", "numpy", "scikit-learn", "lightgbm",
                    "--break-system-packages", "-q"])
    import lightgbm as lgb
    from sklearn.metrics import roc_auc_score
    from sklearn.preprocessing import LabelEncoder

DATA_FILE = Path(__file__).parent / "hkjc_results_v5.json"

FEATURES = [
    "distance", "class_num", "field_size",
    "draw", "rel_draw",
    "act_weight", "rel_weight",
    "market_prob", "odds_rank", "is_favourite",
    "jockey_win_rate", "jockey_top3_rate",
    "trainer_win_rate",
    "combo_win_rate",
    "horse_avg_pos", "horse_win_rate_hist", "horse_last_pos",
]
CAT_FEATURES_RAW = ["venue", "going", "track", "jockey", "trainer"]


# ══════════════════════════════════════════════════════════
# 1. 載入資料
# ══════════════════════════════════════════════════════════
def load_data(path: Path) -> pd.DataFrame:
    data = json.load(open(path, encoding="utf-8"))
    rows = []
    for day in data:
        for race in day["races"]:
            detail = race.get("detail", {})
            dist_raw = detail.get("distance", "")
            dist_num = int("".join(filter(str.isdigit, dist_raw))) if dist_raw else 0
            field_size = len(race["runners"])
            for r in race["runners"]:
                try: pos = int(r.get("position", 99))
                except: pos = 99
                try: odds = float(r.get("win_odds", 0) or 0)
                except: odds = 0
                try: act_wt = int(r.get("act_weight", 0) or 0)
                except: act_wt = 0
                try: draw = int(r.get("draw", 0) or 0)
                except: draw = 0

                rows.append({
                    "date": day["date"], "venue": day["venue"],
                    "race_no": race["race_no"],
                    "distance": dist_num,
                    "race_class": detail.get("race_class", ""),
                    "going": detail.get("going", ""),
                    "track": detail.get("track", ""),
                    "field_size": field_size,
                    "position": pos, "won": int(pos == 1), "top3": int(pos <= 3),
                    "horse_no": int(r.get("horse_no", 0) or 0),
                    "horse_code": r.get("horse_code", ""),
                    "horse_name": r.get("horse_name", ""),
                    "jockey": r.get("jockey", ""),
                    "trainer": r.get("trainer", ""),
                    "act_weight": act_wt, "draw": draw,
                    "win_odds": odds,
                    "market_prob": 1 / odds if odds > 0 else 0,
                })
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["date", "race_no"]).reset_index(drop=True)
    return df


# ══════════════════════════════════════════════════════════
# 2. Feature Engineering（嚴格按時序，防 leakage）
# ══════════════════════════════════════════════════════════
def build_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy().sort_values("date").reset_index(drop=True)

    class_map = {"第一班": 1, "第二班": 2, "第三班": 3, "第四班": 4, "第五班": 5,
                 "讓賽": 3, "班際": 3, "新馬": 4, "古典": 2, "大賽": 1}
    df["class_num"] = df["race_class"].map(class_map).fillna(3)

    # Rolling stats（只用過去資料，不包含當行）
    jockey_hist  = defaultdict(list)
    trainer_hist = defaultdict(list)
    combo_hist   = defaultdict(list)
    horse_hist   = defaultdict(list)

    j_wr_list, j_t3_list = [], []
    t_wr_list = []
    c_wr_list = []
    h_avgpos_list, h_winrate_list, h_lastpos_list = [], [], []

    for _, row in df.iterrows():
        j = row["jockey"]; t = row["trainer"]; h = row["horse_code"]

        # Jockey
        jh = jockey_hist[j]
        j_wr_list.append(np.mean([x[0] for x in jh[-60:]]) if len(jh) >= 5 else np.nan)
        j_t3_list.append(np.mean([x[1] for x in jh[-60:]]) if len(jh) >= 5 else np.nan)
        jockey_hist[j].append((row["won"], row["top3"]))

        # Trainer
        th = trainer_hist[t]
        t_wr_list.append(np.mean(th[-60:]) if len(th) >= 5 else np.nan)
        trainer_hist[t].append(row["won"])

        # Combo
        key = (j, t); ch = combo_hist[key]
        c_wr_list.append(np.mean(ch[-30:]) if len(ch) >= 3 else np.nan)
        combo_hist[key].append(row["won"])

        # Horse
        hh = horse_hist[h]
        if len(hh) >= 2:
            recent = hh[-6:]
            h_avgpos_list.append(np.mean([x[0] for x in recent]))
            h_winrate_list.append(np.mean([x[1] for x in recent]))
            h_lastpos_list.append(hh[-1][0])
        else:
            h_avgpos_list.append(np.nan)
            h_winrate_list.append(np.nan)
            h_lastpos_list.append(np.nan)
        pos_val = row["position"] if row["position"] < 20 else 10
        horse_hist[h].append((pos_val, row["won"]))

    df["jockey_win_rate"]    = j_wr_list
    df["jockey_top3_rate"]   = j_t3_list
    df["trainer_win_rate"]   = t_wr_list
    df["combo_win_rate"]     = c_wr_list
    df["horse_avg_pos"]      = h_avgpos_list
    df["horse_win_rate_hist"] = h_winrate_list
    df["horse_last_pos"]     = h_lastpos_list

    # Race-level features
    df["race_id"] = df["date"].astype(str) + "_R" + df["race_no"].astype(str)
    df["mean_weight_in_race"] = df.groupby("race_id")["act_weight"].transform("mean")
    df["rel_weight"] = df["act_weight"] - df["mean_weight_in_race"]
    df["odds_rank"] = df.groupby("race_id")["win_odds"].rank(ascending=True)
    df["is_favourite"] = (df["odds_rank"] == 1).astype(int)
    df["rel_draw"] = df["draw"] / df["field_size"].clip(1)

    return df


# ══════════════════════════════════════════════════════════
# 3. Walk-Forward Backtest
# ══════════════════════════════════════════════════════════
def walk_forward_backtest(df: pd.DataFrame, min_train_days: int = 30,
                          value_threshold: float = 1.3, stake: float = 10.0):

    all_dates = sorted(df["date"].unique())
    print(f"\n總賽馬日: {len(all_dates)} | 最少訓練日: {min_train_days}")
    print(f"Value Bet 門檻: {value_threshold}x | 每注: ${stake}")
    print("═" * 65)

    # 儲存每日結果
    results = []
    bet_log = []

    for i in range(min_train_days, len(all_dates)):
        test_date = all_dates[i]
        train_df = df[df["date"] < test_date].copy()
        test_df  = df[df["date"] == test_date].copy()

        # 過濾有效出賽（排除退出）
        train_df = train_df[train_df["position"] < 20]
        test_df_valid = test_df[test_df["win_odds"] > 0].copy()
        if len(test_df_valid) == 0:
            continue

        # Label encode
        all_features = FEATURES + [c + "_enc" for c in CAT_FEATURES_RAW]
        for col in CAT_FEATURES_RAW:
            le = LabelEncoder()
            all_vals = pd.concat([train_df[col], test_df_valid[col]]).astype(str)
            le.fit(all_vals)
            train_df[col + "_enc"] = le.transform(train_df[col].astype(str))
            test_df_valid[col + "_enc"] = le.transform(test_df_valid[col].astype(str))

        X_train = train_df[all_features].fillna(-1)
        y_train = train_df["won"]
        X_test  = test_df_valid[all_features].fillna(-1)

        if y_train.sum() < 5:
            continue

        # Train LightGBM
        model = lgb.LGBMClassifier(
            n_estimators=300, learning_rate=0.05,
            num_leaves=31, max_depth=5,
            min_child_samples=10, subsample=0.8,
            colsample_bytree=0.8, class_weight="balanced",
            random_state=42, verbose=-1,
        )
        model.fit(X_train, y_train)

        test_df_valid = test_df_valid.copy()
        test_df_valid["model_prob"] = model.predict_proba(X_test)[:, 1]
        test_df_valid["model_prob_norm"] = test_df_valid.groupby("race_id")["model_prob"].transform(
            lambda x: x / x.sum() if x.sum() > 0 else x
        )
        test_df_valid["market_prob_norm"] = test_df_valid.groupby("race_id")["market_prob"].transform(
            lambda x: x / x.sum() if x.sum() > 0 else x
        )
        test_df_valid["value_ratio"] = (
            test_df_valid["model_prob_norm"] / test_df_valid["market_prob_norm"].clip(0.01)
        )

        # 每場統計
        day_races = 0; day_correct_model = 0; day_correct_baseline = 0

        for race_id, race in test_df_valid.groupby("race_id"):
            race_no = race["race_no"].iloc[0]
            day_races += 1

            # Model top pick
            model_pick = race.loc[race["model_prob_norm"].idxmax()]
            baseline_pick = race.loc[race["win_odds"].idxmin()]  # 大熱門
            actual_winner = race[race["position"] == 1]

            if len(actual_winner) > 0:
                winner_name = actual_winner.iloc[0]["horse_name"]
                if model_pick["horse_name"] == winner_name: day_correct_model += 1
                if baseline_pick["horse_name"] == winner_name: day_correct_baseline += 1

            # ── 策略1: Value Bet（模型 > 市場 × threshold）──
            value_bets = race[race["value_ratio"] >= value_threshold]
            for _, bet in value_bets.iterrows():
                won = int(bet["position"] == 1)
                pnl = stake * bet["win_odds"] - stake if won else -stake
                bet_log.append({
                    "date": test_date, "race_no": race_no,
                    "strategy": "value_bet",
                    "horse": bet["horse_name"], "jockey": bet["jockey"],
                    "odds": bet["win_odds"],
                    "model_prob": bet["model_prob_norm"],
                    "market_prob": bet["market_prob_norm"],
                    "value_ratio": bet["value_ratio"],
                    "won": won, "pnl": pnl, "stake": stake,
                })

            # ── 策略2: 只買大熱門 ──
            fav = race.loc[race["win_odds"].idxmin()]
            won_fav = int(fav["position"] == 1)
            pnl_fav = stake * fav["win_odds"] - stake if won_fav else -stake
            bet_log.append({
                "date": test_date, "race_no": race_no,
                "strategy": "favourite",
                "horse": fav["horse_name"], "odds": fav["win_odds"],
                "won": won_fav, "pnl": pnl_fav, "stake": stake,
            })

            # ── 策略3: Model Top Pick 每場必買 ──
            won_model = int(model_pick["position"] == 1)
            pnl_model = stake * model_pick["win_odds"] - stake if won_model else -stake
            bet_log.append({
                "date": test_date, "race_no": race_no,
                "strategy": "model_top",
                "horse": model_pick["horse_name"], "odds": model_pick["win_odds"],
                "won": won_model, "pnl": pnl_model, "stake": stake,
            })

        results.append({
            "date": test_date,
            "races": day_races,
            "model_correct": day_correct_model,
            "baseline_correct": day_correct_baseline,
        })
        print(f"  {str(test_date.date())} | 場次:{day_races} | 模型:{day_correct_model}/{day_races} | 大熱:{day_correct_baseline}/{day_races}")

    return pd.DataFrame(results), pd.DataFrame(bet_log)


# ══════════════════════════════════════════════════════════
# 4. 結果分析
# ══════════════════════════════════════════════════════════
def analyse_results(results_df: pd.DataFrame, bet_log: pd.DataFrame, stake: float):
    print("\n" + "═" * 65)
    print("📊 BACKTEST 結果總覽")
    print("═" * 65)

    total_days = len(results_df)
    total_races = results_df["races"].sum()

    print(f"\n測試期間: {results_df['date'].min().date()} ~ {results_df['date'].max().date()}")
    print(f"測試賽馬日: {total_days} | 總場次: {total_races}")

    # ── 預測準確率 ──
    model_acc = results_df["model_correct"].sum() / total_races
    base_acc  = results_df["baseline_correct"].sum() / total_races
    print(f"\n🎯 冠軍預測準確率:")
    print(f"   LightGBM 模型: {model_acc:.1%} ({results_df['model_correct'].sum()}/{total_races}場)")
    print(f"   大熱門 Baseline: {base_acc:.1%} ({results_df['baseline_correct'].sum()}/{total_races}場)")
    print(f"   差距: {(model_acc - base_acc)*100:+.1f}%")

    # ── 各策略財務表現 ──
    print(f"\n💰 各策略財務表現（每注 ${stake:.0f}）")
    print(f"{'策略':<18} {'下注數':>6} {'勝出':>6} {'勝率':>7} {'總投入':>9} {'總回報':>9} {'ROI':>8} {'最大連輸':>9}")
    print("─" * 75)

    for strategy in ["value_bet", "favourite", "model_top"]:
        sb = bet_log[bet_log["strategy"] == strategy]
        if len(sb) == 0:
            continue

        n_bets    = len(sb)
        n_won     = sb["won"].sum()
        win_rate  = n_won / n_bets
        total_in  = n_bets * stake
        total_ret = sb["pnl"].sum() + total_in  # 總回收
        roi       = sb["pnl"].sum() / total_in

        # 最大連輸
        max_lose = 0; cur_lose = 0
        for w in sb["won"]:
            if w == 0:
                cur_lose += 1
                max_lose = max(max_lose, cur_lose)
            else:
                cur_lose = 0

        names = {"value_bet": "Value Bet", "favourite": "只買大熱門", "model_top": "模型首選"}
        print(f"  {names[strategy]:<16} {n_bets:>6} {n_won:>6} {win_rate:>6.1%} "
              f"${total_in:>8,.0f} ${total_ret:>8,.0f} {roi:>+7.1%} {max_lose:>9}連")

    # ── Value Bet 詳細分析 ──
    vb = bet_log[bet_log["strategy"] == "value_bet"].copy()
    if len(vb) > 0:
        print(f"\n⚡ Value Bet 深度分析")
        print(f"{'─'*50}")

        # 按賠率分組
        vb["odds_bin"] = pd.cut(vb["odds"], bins=[1,3,6,10,20,100],
                                 labels=["1-3", "3-6", "6-10", "10-20", "20+"])
        odds_analysis = vb.groupby("odds_bin", observed=True).agg(
            bets=("won","count"), wins=("won","sum"),
            roi=("pnl","sum"), stake_sum=("stake","sum")
        ).reset_index()
        odds_analysis["win_rate"] = odds_analysis["wins"] / odds_analysis["bets"]
        odds_analysis["roi_pct"] = odds_analysis["roi"] / odds_analysis["stake_sum"]

        print("  按賠率分析:")
        for _, r in odds_analysis.iterrows():
            bar = "█" * int(max(0, r["roi_pct"] * 20)) if r["roi_pct"] > 0 else "░" * int(abs(r["roi_pct"]) * 20)
            print(f"  {r['odds_bin']:>6}倍 | {int(r['bets']):>4}注 | 勝{r['win_rate']:>5.1%} | ROI {r['roi_pct']:>+6.1%}  {bar}")

        # 月度表現
        vb["month"] = vb["date"].dt.to_period("M")
        monthly = vb.groupby("month").agg(
            bets=("won","count"), wins=("won","sum"),
            pnl=("pnl","sum"), stake_sum=("stake","sum")
        ).reset_index()
        monthly["roi"] = monthly["pnl"] / monthly["stake_sum"]
        print(f"\n  月度 ROI:")
        cumulative = 0
        for _, r in monthly.iterrows():
            cumulative += r["pnl"]
            bar = "█" * int(max(0, r["roi"] * 20)) if r["roi"] > 0 else "░" * int(abs(r["roi"]) * 20)
            print(f"  {r['month']} | {int(r['bets']):>4}注 | ROI {r['roi']:>+6.1%} | 累計 ${cumulative:>+8,.0f}  {bar}")

        # 最佳騎師 × Value Bet
        if "jockey" in vb.columns:
            jockey_vb = vb.groupby("jockey").agg(
                bets=("won","count"), wins=("won","sum"), pnl=("pnl","sum"), stake_sum=("stake","sum")
            ).reset_index()
            jockey_vb = jockey_vb[jockey_vb["bets"] >= 3]
            jockey_vb["roi"] = jockey_vb["pnl"] / jockey_vb["stake_sum"]
            jockey_vb["win_rate"] = jockey_vb["wins"] / jockey_vb["bets"]
            jockey_vb = jockey_vb.sort_values("roi", ascending=False)
            print(f"\n  騎師 Value Bet ROI (≥3注):")
            for _, r in jockey_vb.head(8).iterrows():
                print(f"  {r['jockey']:<8} {int(r['bets']):>3}注 | 勝率{r['win_rate']:>5.1%} | ROI {r['roi']:>+6.1%}")

    # ── 累計收益曲線（文字版）──
    print(f"\n📈 累計收益（Value Bet）")
    print("─" * 50)
    if len(vb) > 0:
        vb_sorted = vb.sort_values("date")
        cum_pnl = vb_sorted["pnl"].cumsum()
        max_pnl = cum_pnl.max()
        min_pnl = cum_pnl.min()
        final_pnl = cum_pnl.iloc[-1]

        # 每10個賽馬日顯示一次
        vb_sorted["cum_pnl"] = cum_pnl
        dates = sorted(vb_sorted["date"].unique())
        step = max(1, len(dates) // 12)
        for d in dates[::step]:
            dp = vb_sorted[vb_sorted["date"] <= d]["pnl"].sum()
            bar_len = int(dp / 20) if dp != 0 else 0
            if bar_len >= 0:
                bar = "█" * min(30, bar_len)
            else:
                bar = "░" * min(30, abs(bar_len))
            print(f"  {str(d.date())} | ${dp:>+8,.0f}  {bar}")

        print(f"\n  最終累計: ${final_pnl:>+,.0f}")
        print(f"  最高點:   ${max_pnl:>+,.0f}")
        print(f"  最低點:   ${min_pnl:>+,.0f}")
        total_invested = len(vb) * stake
        print(f"  總投入:   ${total_invested:>,.0f}")
        print(f"  最終 ROI: {final_pnl/total_invested:>+.1%}")


# ══════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="HKJC Walk-Forward Backtest")
    parser.add_argument("--min-train", type=int, default=30, help="最少訓練日數 (default: 30)")
    parser.add_argument("--threshold", type=float, default=1.3, help="Value Bet 門檻 (default: 1.3)")
    parser.add_argument("--stake", type=float, default=10.0, help="每注金額 (default: 10)")
    args = parser.parse_args()

    print("🔄 載入資料...")
    df = load_data(DATA_FILE)
    print(f"   {len(df)} 條記錄 | {df['date'].nunique()} 個賽馬日")
    print(f"   日期: {df['date'].min().date()} ~ {df['date'].max().date()}")

    print("\n🔧 建構 Rolling Features...")
    df = build_rolling_features(df)

    print(f"\n🤖 開始 Walk-Forward Backtest（最少訓練 {args.min_train} 日）...")
    print("═" * 65)

    results_df, bet_log = walk_forward_backtest(
        df, min_train_days=args.min_train,
        value_threshold=args.threshold, stake=args.stake
    )

    if len(bet_log) == 0:
        print("❌ 沒有產生下注記錄。嘗試降低 --threshold 值。")
        return

    analyse_results(results_df, bet_log, args.stake)

    # 儲存 CSV
    out_path = Path(__file__).parent / "hkjc_backtest_results.csv"
    bet_log.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"\n💾 詳細下注記錄已儲存: {out_path.name}")
    print("\n✅ Backtest 完成！")


if __name__ == "__main__":
    main()
