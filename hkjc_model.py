#!/usr/bin/env python3
"""
HKJC 賽馬預測模型
- Train: 除最後一個賽馬日以外所有資料
- Test:  最後一個賽馬日（驗證）
- 目標: 預測每場各馬匹勝率，找出 Value Bet（模型概率 > 賠率隱含概率）

安裝: pip3 install pandas numpy scikit-learn lightgbm --break-system-packages
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from collections import defaultdict

# ── 安裝檢查 ──────────────────────────────────────────────
try:
    import lightgbm as lgb
    from sklearn.metrics import log_loss, roc_auc_score
    from sklearn.preprocessing import LabelEncoder
except ImportError:
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "pip", "install",
                    "pandas", "numpy", "scikit-learn", "lightgbm",
                    "--break-system-packages", "-q"])
    import lightgbm as lgb
    from sklearn.metrics import log_loss, roc_auc_score
    from sklearn.preprocessing import LabelEncoder

DATA_FILE = Path(__file__).parent / "hkjc_results_v5.json"


# ══════════════════════════════════════════════════════════
# 1. 資料載入 & 展平
# ══════════════════════════════════════════════════════════
def load_data(path: Path) -> pd.DataFrame:
    data = json.load(open(path, encoding="utf-8"))
    rows = []
    for day in data:
        date = day["date"]
        venue = day["venue"]
        for race in day["races"]:
            race_no = race["race_no"]
            detail = race.get("detail", {})
            distance_raw = detail.get("distance", "")
            # 提取數字距離
            dist_num = int("".join(filter(str.isdigit, distance_raw))) if distance_raw else 0
            race_class = detail.get("race_class", "")
            going = detail.get("going", "")
            track = detail.get("track", "")
            field_size = len(race["runners"])

            for r in race["runners"]:
                pos_raw = r.get("position", "")
                try:
                    pos = int(pos_raw)
                except:
                    pos = 99  # 退出/取消

                try:
                    odds = float(r.get("win_odds", 0) or 0)
                except:
                    odds = 0

                try:
                    act_wt = int(r.get("act_weight", 0) or 0)
                except:
                    act_wt = 0

                try:
                    decl_wt = int(r.get("decl_weight", 0) or 0)
                except:
                    decl_wt = 0

                try:
                    draw = int(r.get("draw", 0) or 0)
                except:
                    draw = 0

                # 沿途走位（取最後一個數字 = 入直路位置）
                running_pos_raw = r.get("running_pos", "")
                pos_list = [int(x) for x in running_pos_raw.split() if x.isdigit()]
                last_run_pos = pos_list[-1] if pos_list else 0
                first_run_pos = pos_list[0] if pos_list else 0

                rows.append({
                    "date": date,
                    "venue": venue,
                    "race_no": race_no,
                    "distance": dist_num,
                    "race_class": race_class,
                    "going": going,
                    "track": track,
                    "field_size": field_size,
                    "position": pos,
                    "won": 1 if pos == 1 else 0,
                    "top3": 1 if pos <= 3 else 0,
                    "horse_no": int(r.get("horse_no", 0) or 0),
                    "horse_code": r.get("horse_code", ""),
                    "horse_name": r.get("horse_name", ""),
                    "jockey": r.get("jockey", ""),
                    "trainer": r.get("trainer", ""),
                    "act_weight": act_wt,
                    "decl_weight": decl_wt,
                    "draw": draw,
                    "win_odds": odds,
                    "market_prob": 1 / odds if odds > 0 else 0,
                    "last_run_pos": last_run_pos,
                    "first_run_pos": first_run_pos,
                    "running_pos_raw": running_pos_raw,
                })

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["date", "race_no", "position"]).reset_index(drop=True)
    return df


# ══════════════════════════════════════════════════════════
# 2. Feature Engineering
# ══════════════════════════════════════════════════════════
def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy().sort_values("date")

    # ── 騎師近期勝率（過去 60 場出賽） ──
    jockey_wins = defaultdict(list)
    jockey_win_rate = []
    jockey_top3_rate = []
    for _, row in df.iterrows():
        j = row["jockey"]
        hist = jockey_wins[j]
        if len(hist) >= 5:
            jockey_win_rate.append(np.mean([h[0] for h in hist[-60:]]))
            jockey_top3_rate.append(np.mean([h[1] for h in hist[-60:]]))
        else:
            jockey_win_rate.append(np.nan)
            jockey_top3_rate.append(np.nan)
        jockey_wins[j].append((row["won"], row["top3"]))

    df["jockey_win_rate"] = jockey_win_rate
    df["jockey_top3_rate"] = jockey_top3_rate

    # ── 練馬師近期勝率 ──
    trainer_wins = defaultdict(list)
    trainer_win_rate = []
    for _, row in df.iterrows():
        t = row["trainer"]
        hist = trainer_wins[t]
        if len(hist) >= 5:
            trainer_win_rate.append(np.mean([h for h in hist[-60:]]))
        else:
            trainer_win_rate.append(np.nan)
        trainer_wins[t].append(row["won"])

    df["trainer_win_rate"] = trainer_win_rate

    # ── 騎師×練馬師組合勝率 ──
    combo_wins = defaultdict(list)
    combo_win_rate = []
    for _, row in df.iterrows():
        key = (row["jockey"], row["trainer"])
        hist = combo_wins[key]
        if len(hist) >= 3:
            combo_win_rate.append(np.mean(hist[-30:]))
        else:
            combo_win_rate.append(np.nan)
        combo_wins[key].append(row["won"])
    df["combo_win_rate"] = combo_win_rate

    # ── 馬匹近期表現 ──
    horse_hist = defaultdict(list)
    horse_avg_pos = []
    horse_win_rate = []
    horse_last_pos = []
    for _, row in df.iterrows():
        h = row["horse_code"]
        hist = horse_hist[h]
        if len(hist) >= 2:
            recent = hist[-6:]
            horse_avg_pos.append(np.mean([x[0] for x in recent]))
            horse_win_rate.append(np.mean([x[1] for x in recent]))
            horse_last_pos.append(hist[-1][0])
        else:
            horse_avg_pos.append(np.nan)
            horse_win_rate.append(np.nan)
            horse_last_pos.append(np.nan)
        horse_hist[h].append((row["position"] if row["position"] < 99 else 10, row["won"]))

    df["horse_avg_pos"] = horse_avg_pos
    df["horse_win_rate_hist"] = horse_win_rate
    df["horse_last_pos"] = horse_last_pos

    # ── 場內負磅相對值（相對同場平均） ──
    race_id = df["date"].astype(str) + "_" + df["race_no"].astype(str)
    df["race_id"] = race_id
    df["mean_weight_in_race"] = df.groupby("race_id")["act_weight"].transform("mean")
    df["rel_weight"] = df["act_weight"] - df["mean_weight_in_race"]

    # ── 賠率排名（同場內） ──
    df["odds_rank"] = df.groupby("race_id")["win_odds"].rank(ascending=True)
    df["is_favourite"] = (df["odds_rank"] == 1).astype(int)

    # ── 檔位相對場地大小 ──
    df["rel_draw"] = df["draw"] / df["field_size"].clip(1)

    # ── 賽事等級數字化 ──
    class_map = {"第一班": 1, "第二班": 2, "第三班": 3, "第四班": 4, "第五班": 5,
                 "班際": 3, "讓賽": 3, "新馬": 4, "古典": 2, "大賽": 1}
    df["class_num"] = df["race_class"].map(class_map).fillna(3)

    return df


# ══════════════════════════════════════════════════════════
# 3. 訓練 LightGBM 模型
# ══════════════════════════════════════════════════════════
FEATURES = [
    # ── 比賽前已知資訊（Pre-race features only）──
    "distance", "class_num", "field_size",
    "draw", "rel_draw",
    "act_weight", "rel_weight",
    "market_prob",           # 賠率隱含概率
    "odds_rank", "is_favourite",
    # ── 歷史統計（rolling，由過去資料計算） ──
    "jockey_win_rate", "jockey_top3_rate",
    "trainer_win_rate",
    "combo_win_rate",
    "horse_avg_pos", "horse_win_rate_hist", "horse_last_pos",
    # ⚠️ last_run_pos / first_run_pos 係比賽內資料，已移除
]

CAT_FEATURES_RAW = ["venue", "going", "track", "jockey", "trainer"]


def train_and_evaluate(df: pd.DataFrame):
    # ── Train/Test Split: 最後一個賽馬日作 test ──
    last_date = df["date"].max()
    test_dates = [last_date]

    print(f"\n{'='*60}")
    print(f"📅 Train: {df['date'].min().date()} ~ {df[df['date'] < last_date]['date'].max().date()}")
    print(f"📅 Test:  {last_date.date()} ({df[df['date']==last_date]['race_no'].max()} 場)")
    print(f"{'='*60}\n")

    train_df = df[df["date"] < last_date].copy()
    test_df  = df[df["date"] == last_date].copy()

    # Label encode categorical
    le_dict = {}
    for col in CAT_FEATURES_RAW:
        le = LabelEncoder()
        all_vals = pd.concat([train_df[col], test_df[col]]).astype(str)
        le.fit(all_vals)
        train_df[col + "_enc"] = le.transform(train_df[col].astype(str))
        test_df[col + "_enc"]  = le.transform(test_df[col].astype(str))
        le_dict[col] = le

    cat_features_enc = [c + "_enc" for c in CAT_FEATURES_RAW]
    all_features = FEATURES + cat_features_enc

    # 填補 NaN
    train_df[all_features] = train_df[all_features].fillna(-1)
    test_df[all_features]  = test_df[all_features].fillna(-1)

    X_train = train_df[all_features]
    y_train = train_df["won"]
    X_test  = test_df[all_features]
    y_test  = test_df["won"]

    print(f"Train: {len(train_df)} 條記錄 | {y_train.sum()} 場勝出")
    print(f"Test:  {len(test_df)} 條記錄 | {y_test.sum()} 場勝出\n")

    # ── LightGBM ──
    model = lgb.LGBMClassifier(
        n_estimators=500,
        learning_rate=0.05,
        num_leaves=31,
        max_depth=6,
        min_child_samples=10,
        subsample=0.8,
        colsample_bytree=0.8,
        class_weight="balanced",
        random_state=42,
        verbose=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(0)],
    )

    # ── 評估 ──
    test_df = test_df.copy()
    test_df["model_prob"] = model.predict_proba(X_test)[:, 1]

    # Normalize 同場內概率（summing to 1）
    test_df["model_prob_norm"] = test_df.groupby("race_id")["model_prob"].transform(
        lambda x: x / x.sum()
    )

    auc = roc_auc_score(y_test, test_df["model_prob"])
    ll  = log_loss(y_test, test_df["model_prob"])
    print(f"📊 AUC:      {auc:.4f}  (隨機=0.5，越高越好)")
    print(f"📊 Log Loss: {ll:.4f}")

    # ── Value Bet 分析 ──
    print(f"\n{'='*60}")
    print("🎯 Value Bet 分析（模型概率 > 賠率隱含概率 × 1.2）")
    print(f"{'='*60}")

    test_df["value"] = test_df["model_prob_norm"] - test_df["market_prob"]
    test_df["value_ratio"] = test_df["model_prob_norm"] / test_df["market_prob"].clip(0.01)

    value_bets = test_df[test_df["value_ratio"] > 1.2].sort_values("value_ratio", ascending=False)

    print(f"\n{'場次':<5} {'馬名':<12} {'騎師':<8} {'賠率':>6} {'市場%':>7} {'模型%':>7} {'Value':>7} {'實際名次':>8}")
    print("-" * 70)
    for _, row in value_bets.iterrows():
        actual = row["position"]
        pos_str = f"🏆 第{int(actual)}名" if actual <= 3 else f"第{int(actual)}名"
        print(f"R{int(row['race_no']):<4} {row['horse_name']:<12} {row['jockey']:<8} "
              f"{row['win_odds']:>6.1f} "
              f"{row['market_prob']*100:>6.1f}% "
              f"{row['model_prob_norm']*100:>6.1f}% "
              f"{row['value_ratio']:>6.2f}x  {pos_str}")

    # Value bet 成效
    if len(value_bets) > 0:
        hit_rate = (value_bets["position"] == 1).mean()
        top3_rate = (value_bets["position"] <= 3).mean()
        print(f"\nValue Bet 勝出率: {hit_rate:.1%} ({int((value_bets['position']==1).sum())}/{len(value_bets)})")
        print(f"Value Bet 位置率: {top3_rate:.1%}")

    # ── 每場預測排名 ──
    print(f"\n{'='*60}")
    print("🏇 每場預測 vs 實際（Test Day）")
    print(f"{'='*60}")

    for race_no in sorted(test_df["race_no"].unique()):
        race = test_df[test_df["race_no"] == race_no].sort_values("model_prob_norm", ascending=False)
        winner_row = race[race["position"] == 1]
        winner_name = winner_row["horse_name"].values[0] if len(winner_row) else "?"
        pred_top1 = race.iloc[0]
        correct = "✅" if pred_top1["position"] == 1 else "❌"

        print(f"\nR{race_no} {correct} 預測: {pred_top1['horse_name']}({pred_top1['model_prob_norm']*100:.1f}%)  "
              f"| 實際冠軍: {winner_name}({race[race['horse_name']==winner_name]['model_prob_norm'].values[0]*100:.1f}%)")
        for _, r in race.head(4).iterrows():
            flag = "🏆" if r["position"] == 1 else f"  "
            print(f"   {flag} #{int(r['horse_no'])} {r['horse_name']:<12} "
                  f"賠率:{r['win_odds']:>5.1f} 模型:{r['model_prob_norm']*100:>5.1f}%  名次:第{int(r['position'])}名")

    # ── Feature Importance ──
    print(f"\n{'='*60}")
    print("📈 Feature Importance (Top 15)")
    print(f"{'='*60}")
    importance = pd.DataFrame({
        "feature": all_features,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False).head(15)
    for _, row in importance.iterrows():
        bar = "█" * int(row["importance"] / importance["importance"].max() * 30)
        print(f"  {row['feature']:<25} {bar} {row['importance']:.0f}")

    # ── Baseline 比較（只用賠率） ──
    print(f"\n{'='*60}")
    print("📊 Baseline 比較")
    print(f"{'='*60}")
    baseline_correct = 0
    model_correct = 0
    for race_no in test_df["race_no"].unique():
        race = test_df[test_df["race_no"] == race_no]
        baseline_pred = race.loc[race["win_odds"].idxmin(), "horse_name"]
        model_pred = race.loc[race["model_prob_norm"].idxmax(), "horse_name"]
        actual_winner = race[race["position"] == 1]["horse_name"].values
        if len(actual_winner) > 0:
            if baseline_pred == actual_winner[0]: baseline_correct += 1
            if model_pred == actual_winner[0]: model_correct += 1

    total_races = len(test_df["race_no"].unique())
    print(f"  最低賠率（大熱）預測正確: {baseline_correct}/{total_races} ({baseline_correct/total_races:.1%})")
    print(f"  LightGBM 模型預測正確:    {model_correct}/{total_races} ({model_correct/total_races:.1%})")

    return model, test_df


# ══════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("🔄 載入資料...")
    df_raw = load_data(DATA_FILE)
    print(f"   共 {len(df_raw)} 條記錄，{df_raw['date'].nunique()} 個賽馬日")

    print("🔧 建構 Features...")
    df_feat = build_features(df_raw)

    print("🤖 訓練模型...")
    model, results = train_and_evaluate(df_feat)

    print("\n✅ 完成！")
