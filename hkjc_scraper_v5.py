#!/usr/bin/env python3
"""
HKJC Horse Racing Scraper v5
用 Playwright 抓取 localresults 頁面，獲取每場全部馬匹完整資料。

欄位: 名次、馬號、馬名、馬匹代碼、騎師、練馬師、實際負磅、排位體重、
      檔位、頭馬距離、沿途走位、完成時間、獨贏賠率

使用方法:
  python3 hkjc_scraper_v5.py                   # 預設: 抓過去 30 天
  python3 hkjc_scraper_v5.py --days 400         # 過去 400 天 (~一年多)
  python3 hkjc_scraper_v5.py --from 2025-03-01  # 從指定日期開始
  python3 hkjc_scraper_v5.py --append           # 追加模式（跳過已有資料）

輸出: hkjc_results_v5.json
"""

import asyncio
import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    from playwright.async_api import async_playwright, TimeoutError as PWTimeout
except ImportError:
    print("❌ 需要安裝 playwright: pip install playwright && playwright install chromium")
    sys.exit(1)


RESULTS_ALL_URL = "https://racing.hkjc.com/racing/information/Chinese/Racing/ResultsAll.aspx"
LOCAL_RESULTS_URL = "https://racing.hkjc.com/racing/information/Chinese/Racing/LocalResults.aspx"
OUTPUT_FILE = Path(__file__).parent / "hkjc_results_v5.json"
DELAY_MS = 600


async def get_available_dates(page) -> list[tuple[str, str]]:
    """
    從 ResultsAll 頁面取得所有可用賽馬日。
    返回: [(raw_dd/mm/yyyy, iso_yyyy-mm-dd), ...]
    """
    await page.goto(f"{RESULTS_ALL_URL}?RaceDate=2026/03/11", wait_until="networkidle", timeout=20000)
    text = await page.evaluate("() => document.body.innerText")
    matches = re.findall(r"\d{2}/\d{2}/\d{4}", text)
    seen = set()
    result = []
    for m in matches:
        if m not in seen:
            seen.add(m)
            d, mo, y = m.split("/")
            iso = f"{y}-{mo}-{d}"
            result.append((m, iso))
    return result


async def get_race_count(page, url_date: str) -> int:
    """從 ResultsAll 頁面取得該日場次數"""
    url = f"{RESULTS_ALL_URL}?RaceDate={url_date}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=15000)
    except PWTimeout:
        return 0
    no_data = await page.evaluate("() => document.body.innerText.includes('沒有相關資料')")
    if no_data:
        return 0
    count = await page.evaluate("""
        () => document.querySelectorAll('table.result').length
    """)
    return count


async def scrape_race(page, url_date: str, race_no: int) -> dict | None:
    """
    抓取單場賽事完整結果（全部馬匹）。
    url_date: YYYY/MM/DD
    返回: race dict 或 None
    """
    url = f"{LOCAL_RESULTS_URL}?RaceDate={url_date}&RaceNo={race_no}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=15000)
    except PWTimeout:
        return None

    data = await page.evaluate("""
        () => {
            // 主要賽果表（12欄完整版）
            const table = document.querySelector('table.f_tac');
            if (!table) return null;

            const rows = table.querySelectorAll('tr');
            if (rows.length < 2) return null;

            // 確認欄位順序
            const headers = Array.from(rows[0].querySelectorAll('td'))
                                 .map(td => td.innerText.trim());

            const runners = [];
            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                if (cells.length < 10) continue;

                // 馬名欄包含 horse_code，例如: 風采人生 (J366)
                const nameRaw = cells[2].innerText.trim();
                const nameMatch = nameRaw.match(/^(.+?)\s*\(([A-Z]\d+)\)\s*$/);
                const horseName = nameMatch ? nameMatch[1].trim() : nameRaw;
                const horseCode = nameMatch ? nameMatch[2] : '';

                const getText = (c, i) => (c[i] && c[i].innerText) ? c[i].innerText.trim() : '';
                runners.push({
                    position:      getText(cells, 0),
                    horse_no:      getText(cells, 1),
                    horse_name:    horseName,
                    horse_code:    horseCode,
                    jockey:        getText(cells, 3),
                    trainer:       getText(cells, 4),
                    act_weight:    getText(cells, 5),
                    decl_weight:   getText(cells, 6),
                    draw:          getText(cells, 7),
                    margin:        getText(cells, 8),
                    running_pos:   getText(cells, 9),
                    finish_time:   getText(cells, 10),
                    win_odds:      getText(cells, 11),
                });
            }

            // 賽事資訊（場地、距離、等級等）
            const infoText = document.body.innerText.slice(0, 2000);

            // 派彩
            const divTable = document.querySelector('table.dividends');
            const dividends = [];
            if (divTable) {
                const divRows = divTable.querySelectorAll('tbody tr');
                divRows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        dividends.push({
                            pool: cells[0].innerText.trim(),
                            combination: cells[1].innerText.trim(),
                            dividend: cells[2].innerText.trim(),
                        });
                    } else if (cells.length === 2) {
                        dividends.push({
                            pool: '',
                            combination: cells[0].innerText.trim(),
                            dividend: cells[1].innerText.trim(),
                        });
                    }
                });
            }

            return { headers, runners, dividends };
        }
    """)

    if not data or not data.get("runners"):
        return None

    # 抓賽事詳情（距離、等級、場地狀況等）
    race_detail = await page.evaluate("""
        () => {
            const detail = {};
            const bodyText = document.body.innerText;

            // 賽事名稱
            const nameMatch = bodyText.match(/第\\s*(\\d+)\\s*場/);
            if (nameMatch) detail.race_no_label = nameMatch[0];

            // 距離
            const distMatch = bodyText.match(/(\\d{3,4})米/);
            if (distMatch) detail.distance = distMatch[1] + '米';

            // 等級
            const classMatch = bodyText.match(/(第[一二三四五]班|班際|讓賽|新馬|古典|大賽)/);
            if (classMatch) detail.race_class = classMatch[1];

            // 場地狀況
            const goingMatch = bodyText.match(/(好地|好至快地|快地|軟地|黏地|重地)/);
            if (goingMatch) detail.going = goingMatch[1];

            // 跑道
            const trackMatch = bodyText.match(/(草地|沙地|全天候跑道)/);
            if (trackMatch) detail.track = trackMatch[1];

            return detail;
        }
    """)

    return {
        "race_no": race_no,
        "detail": race_detail,
        "runners": data["runners"],
        "dividends": data["dividends"],
    }


async def scrape_day(page, raw_date: str, iso_date: str) -> dict | None:
    """抓取單日所有場次"""
    d, m, y = raw_date.split("/")
    url_date = f"{y}/{m}/{d}"

    # 先取得場次數
    race_count = await get_race_count(page, url_date)
    if race_count == 0:
        return None

    # 取得場地
    venue = await page.evaluate("""
        () => {
            const t = document.body.innerText;
            if (t.includes('跑馬地')) return 'HV';
            if (t.includes('沙田')) return 'ST';
            return 'UNKNOWN';
        }
    """)

    print(f"  📍 {iso_date} {venue}: {race_count} 場")

    races = []
    for race_no in range(1, race_count + 1):
        try:
            race_data = await scrape_race(page, url_date, race_no)
        except Exception as e:
            print(f"    R{race_no}: ❌ 錯誤 ({e.__class__.__name__}), 跳過")
            await asyncio.sleep(DELAY_MS / 1000)
            continue
        if race_data:
            total_runners = len(race_data["runners"])
            print(f"    R{race_no}: {total_runners} 匹")
            races.append(race_data)
        else:
            print(f"    R{race_no}: ⚠️ 無資料")
        await asyncio.sleep(DELAY_MS / 1000)

    if not races:
        return None

    return {
        "date": iso_date,
        "venue": venue,
        "total_races": race_count,
        "races": races,
    }


def parse_date_arg(s: str) -> date:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"無法解析日期: {s}")


async def main():
    parser = argparse.ArgumentParser(description="HKJC 賽果 Scraper v5 (完整馬匹資料)")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--days", type=int, default=30, help="過去幾天 (預設 30)")
    group.add_argument("--from", dest="from_date", type=parse_date_arg, help="開始日期 YYYY-MM-DD")
    group.add_argument("--dates", nargs="+", type=parse_date_arg, help="指定日期清單")
    parser.add_argument("--to", dest="to_date", type=parse_date_arg, default=date.today())
    parser.add_argument("--output", type=str, default=str(OUTPUT_FILE))
    parser.add_argument("--append", action="store_true", help="追加模式（跳過已有日期）")
    parser.add_argument("--no-headless", dest="headless", action="store_false", default=True)
    args = parser.parse_args()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=args.headless)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900},
            locale="zh-HK",
        )
        page = await context.new_page()

        print("🔍 取得可用賽馬日清單...")
        available = await get_available_dates(page)
        print(f"   找到 {len(available)} 個賽馬日 ({available[-1][1]} ~ {available[0][1]})")

        # 決定目標日期
        if args.dates:
            target_isos = {d.isoformat() for d in args.dates}
        elif args.from_date:
            target_isos = {iso for _, iso in available
                          if args.from_date.isoformat() <= iso <= args.to_date.isoformat()}
        else:
            cutoff = (date.today() - timedelta(days=args.days)).isoformat()
            target_isos = {iso for _, iso in available if iso >= cutoff}

        to_scrape = [(raw, iso) for raw, iso in available if iso in target_isos]
        to_scrape.reverse()  # 由舊到新

        # 載入已有資料（append 模式）
        existing = {}
        if args.append and Path(args.output).exists():
            with open(args.output, encoding="utf-8") as f:
                old_data = json.load(f)
            existing = {d["date"]: d for d in old_data}
            print(f"   追加模式：已有 {len(existing)} 日，跳過已有日期\n")

        results = dict(existing)
        success = 0

        print(f"🏇 開始抓取 {len(to_scrape)} 個賽馬日...\n")

        for i, (raw_date, iso_date) in enumerate(to_scrape, 1):
            if iso_date in existing:
                print(f"[{i}/{len(to_scrape)}] ⏭️  跳過 {iso_date}")
                continue

            print(f"[{i}/{len(to_scrape)}] {iso_date}...")
            try:
                day_data = await scrape_day(page, raw_date, iso_date)
            except Exception as e:
                print(f"  ❌ {iso_date} 抓取失敗: {e.__class__.__name__}: {e}, 跳過")
                continue

            if day_data:
                results[iso_date] = day_data
                success += 1
            else:
                print(f"  ⚠️  {iso_date} 非賽馬日或無資料")

            # 每 5 日 checkpoint 儲存
            if success > 0 and success % 5 == 0:
                _save(results, args.output)
                print(f"   💾 Checkpoint: 已儲存 {success} 日")

        await browser.close()

    _save(results, args.output)
    total_runners = sum(
        len(race["runners"])
        for day in results.values()
        for race in day["races"]
    )
    print(f"\n✅ 完成！{success} 個新賽馬日，共 {total_runners} 條馬匹記錄 → {args.output}")


def _save(results: dict, path: str):
    sorted_data = sorted(results.values(), key=lambda x: x["date"])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
