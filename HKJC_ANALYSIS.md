# 🏇 HKJC 賽馬分析系統

基於 ~100 個賽馬日的歷史資料，建立統計模型，識別 Value Bet（市場低估馬匹）。

---

## 📊 主要發現（EDA 結果）

### 1. 大熱門仍係最強信號
| 排名 | 勝率 | 位置率 |
|------|------|--------|
| 1 大熱 | **30.1%** | 61.8% |
| 2 大熱 | ~17% | ~46% |
| 3 大熱 | ~13% | ~38% |

- 賠率 1-2 倍：勝率高達 **48.6%**
- 市場整體偏高估中高賠率馬（10-60% 隱含概率段高估 2-14%）

### 2. 檔位效應（顯著）
| 場地 | 最強檔位 | 勝率 |
|------|---------|------|
| HV 跑馬地 | 檔1 | **14.4%**（平均 8.3%）|
| ST 沙田 | 檔1-4 差不多 | ~9-10% |

- 外檔（11-14）明顯劣勢：只有 4-6%

### 3. 騎師差異極大
- **潘頓（Z Purton）：20.8% 勝率**，約係第二名 2 倍
- 潘頓 × 丁冠豪（D Whyte）：**50%**（14 場）🔥
- 潘頓 × 文家良：36.8%

### 4. 磅重效應（反直覺）
- 負 135+ 磅勝率 **12.3%**，最輕組只有 6.9%
- 原因：高磅馬往往係高評分強馬

### 5. 市場偏差
- 中高賠率段（2-3 大熱）**系統性被高估**
- 真正 Value 在：大熱門 + 潘頓特定組合

---

## 🛠 系統架構

```
hkjc_scraper_v5.py          ← 抓取 HKJC GraphQL API 原始資料
scrape_hkjc_full_year.py    ← 批次抓取全年資料
hkjc_to_csv_v5.py           ← JSON → CSV 轉換
hkjc_eda.py                 ← 探索性資料分析（EDA）
hkjc_model.py               ← LightGBM 預測模型
hkjc_race_day_analysis.py   ← 賽事當日即時分析 + Telegram 發送
hkjc_sunday_run.sh          ← 定時執行腳本
```

---

## 🔄 資料流程

```
HKJC GraphQL API
      ↓
hkjc_scraper_v5.py → hkjc_results_v5.json (raw)
      ↓
hkjc_to_csv_v5.py → hkjc_results_v5.csv
      ↓
hkjc_eda.py        → 統計分析 + Trend 發現
hkjc_model.py      → LightGBM 模型訓練
      ↓
hkjc_race_day_analysis.py → 賽事當日 Value Bet 建議
      ↓
Telegram Bot → 自動發送分析報告
```

---

## 🚀 使用方法

### 安裝依賴
```bash
pip3 install pandas numpy scikit-learn lightgbm requests --break-system-packages
```

### 抓取資料
```bash
python3 scrape_hkjc_full_year.py    # 抓取近期資料
```

### 執行 EDA
```bash
python3 hkjc_eda.py
```

### 賽事當日分析
```bash
python3 hkjc_race_day_analysis.py 2026-03-15
python3 hkjc_race_day_analysis.py 2026-03-15 --race 1  # 只看第1場
python3 hkjc_race_day_analysis.py --no-send            # 不發 Telegram
```

---

## 📡 API

- **HKJC GraphQL：** `https://info.cometoluckyjockey.com/graphql/query`
- 可查詢排位、賠率、馬匹資料
- Status: `DECLARED` = 排位已出；比賽日當日才有即時賠率

---

## ⚠️ 已知限制

1. 資料量：~100 個賽馬日，模型仍有改善空間
2. 即時賠率只在比賽日有效
3. LightGBM 模型 AUC 有 data leakage 風險，需嚴格按日期分割
4. 未包含：馬匹狀態、近期表現、場地轉換因素

---

## 📅 自動排程（Crontab）

系統設定星期日自動運行：
- **09:00** — 全場排位預分析
- **12:15** — 賽前最後分析（含賠率 Value Bet）
- **13:00-18:30 每30分鐘** — 即時賠率更新

---

*資料來源: HKJC 公開資料 | 僅供學習研究用途*
