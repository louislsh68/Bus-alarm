#!/usr/bin/env python3
"""
HKJC Horse Racing Scraper v4
用 Playwright 直接渲染 HKJC 賽果頁面，抓取真實歷史資料。

使用方法:
  python3 hkjc_scraper_v4.py                   # 預設: 抓過去 30 天
  python3 hkjc_scraper_v4.py --days 90          # 過去 90 天
  python3 hkjc_scraper_v4.py --from 2025-09-01 --to 2026-03-11  # 指定範圍
  python3 hkjc_scraper_v4.py --dates 2026-03-11 2026-03-08      # 指定日期
  python3 hkjc_scraper_v4.py --list-dates       # 只列出可用日期，不下載資料

輸出: hkjc_results.json
"""

import asyncio
import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

# 安裝: pip install playwright && playwright install chromium
try:
    from playwright.async_api import async_playwright, TimeoutError as PWTimeout
except ImportError:
    print("❌ 需要安裝 playwright: pip install playwright && playwright install chromium")
    sys.exit(1)


BASE_URL = "https://racing.hkjc.com/racing/information/Chinese/Racing/ResultsAll.aspx"
OUTPUT_FILE = Path(__file__).parent / "hkjc_results.json"
DELAY_MS = 800  # 請求間隔，避免被封


async def get_available_dates(page) -> list[str]:
    """從頁面日期下拉清單取得所有可用賽馬日 (格式: DD/MM/YYYY)"""
    await page.goto(f"{BASE_URL}?RaceDate=2026/03/11", wait_until="networkidle")
    dates_raw = await page.evaluate("""
        () => {
            const sel = document.querySelector('select[name="RaceDate"], select.f_fs13');
            if (sel) {
                return Array.from(sel.options).map(o => o.value || o.text.trim()).filter(Boolean);
            }
            // fallback: parse the date dropdown text
            const text = document.body.innerText;
            const matches = text.match(/\\d{2}\\/\\d{2}\\/\\d{4}/g);
            return matches ? [...new Set(matches)] : [];
        }
    """)
    return dates_raw


async def scrape_day(page, race_date: str) -> dict | None:
    """
    抓取單一賽馬日的所有場次結果。
    race_date: 格式 DD/MM/YYYY
    返回: {'date': 'YYYY-MM-DD', 'venue': 'HV/ST', 'races': [...]} 或 None
    """
    # 轉換日期格式: DD/MM/YYYY → YYYY/MM/DD (URL 格式)
    d, m, y = race_date.split("/")
    url_date = f"{y}/{m}/{d}"
    iso_date = f"{y}-{m}-{d}"

    url = f"{BASE_URL}?RaceDate={url_date}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=20000)
    except PWTimeout:
        print(f"  ⏱️ Timeout: {iso_date}")
        return None

    # 檢查是否有賽果資料
    no_data = await page.evaluate("""
        () => document.body.innerText.includes('沒有相關資料')
    """)
    if no_data:
        return None

    # 抓取場地
    venue = await page.evaluate("""
        () => {
            const text = document.body.innerText;
            if (text.includes('跑馬地')) return 'HV';
            if (text.includes('沙田')) return 'ST';
            return 'UNKNOWN';
        }
    """)

    # 抓取所有場次結果
    races = await page.evaluate("""
        () => {
            const resultTables = document.querySelectorAll('table.result');
            const dividendTables = document.querySelectorAll('table.dividends');
            const races = [];

            resultTables.forEach((t, raceIdx) => {
                // Race header info (race name, distance, class, etc.)
                const raceInfo = {};
                const parentSection = t.closest('div.race_data, div') || t.parentElement;
                
                // 嘗試找 race header
                let el = t.previousElementSibling;
                while (el) {
                    const txt = el.innerText;
                    if (txt && txt.length > 5) {
                        raceInfo.header = txt.replace(/\\s+/g, ' ').trim().slice(0, 300);
                        break;
                    }
                    el = el.previousElementSibling;
                }

                // 抓所有馬匹行
                const rows = t.querySelectorAll('tr');
                const runners = [];
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 7) {
                        const posText = cells[0].innerText.trim();
                        runners.push({
                            position: posText,
                            horse_no: cells[1].innerText.trim(),
                            horse_name: cells[2].innerText.trim(),
                            jockey: cells[3].innerText.trim(),
                            trainer: cells[4].innerText.trim(),
                            weight: cells[5].innerText.trim(),
                            draw: cells[6].innerText.trim(),
                        });
                    }
                });

                // 派彩資料
                const divTable = dividendTables[raceIdx];
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
                            // 延續上一個 pool
                            dividends.push({
                                pool: '',
                                combination: cells[0].innerText.trim(),
                                dividend: cells[1].innerText.trim(),
                            });
                        }
                    });
                }

                races.push({
                    race_no: raceIdx + 1,
                    race_info: raceInfo,
                    runners: runners,
                    dividends: dividends,
                });
            });

            return races;
        }
    """)

    if not races:
        return None

    print(f"  ✅ {iso_date} {venue}: {len(races)} 場，首場 {len(races[0]['runners'])} 匹")
    return {
        "date": iso_date,
        "venue": venue,
        "races": races,
    }


def parse_date_arg(s: str) -> date:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"無法解析日期: {s}，請用 YYYY-MM-DD 格式")


async def main():
    parser = argparse.ArgumentParser(description="HKJC 賽果 Scraper v4")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--days", type=int, default=30, help="過去幾天 (預設 30)")
    group.add_argument("--from", dest="from_date", type=parse_date_arg, help="開始日期 YYYY-MM-DD")
    group.add_argument("--dates", nargs="+", type=parse_date_arg, help="指定日期清單")
    parser.add_argument("--to", dest="to_date", type=parse_date_arg, default=date.today(), help="結束日期 YYYY-MM-DD")
    parser.add_argument("--list-dates", action="store_true", help="只列出可用日期")
    parser.add_argument("--output", type=str, default=str(OUTPUT_FILE), help="輸出 JSON 檔案路徑")
    parser.add_argument("--headless", action="store_true", default=True, help="無頭模式 (預設)")
    parser.add_argument("--no-headless", dest="headless", action="store_false", help="顯示瀏覽器")
    parser.add_argument("--append", action="store_true", help="追加到現有 JSON 而非覆蓋")
    args = parser.parse_args()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=args.headless)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            locale="zh-HK",
        )
        page = await context.new_page()

        print("🔍 正在取得可用賽馬日清單...")
        available_raw = await get_available_dates(page)
        
        # 過濾並轉換格式
        available = []
        seen = set()
        for d_raw in available_raw:
            # 格式: DD/MM/YYYY
            if re.match(r"\d{2}/\d{2}/\d{4}", d_raw):
                d_str, m_str, y_str = d_raw.split("/")
                iso = f"{y_str}-{m_str}-{d_str}"
                if iso not in seen:
                    available.append((d_raw, iso))
                    seen.add(iso)

        print(f"   找到 {len(available)} 個賽馬日 ({available[-1][1]} ~ {available[0][1]})")

        if args.list_dates:
            print("\n📅 可用賽馬日:")
            for _, iso in available:
                print(f"   {iso}")
            await browser.close()
            return

        # 決定要抓哪些日期
        if args.dates:
            target_isos = {d.isoformat() for d in args.dates}
        elif args.from_date:
            start = args.from_date
            end = args.to_date
            target_isos = {iso for _, iso in available if start.isoformat() <= iso <= end.isoformat()}
        else:
            cutoff = (date.today() - timedelta(days=args.days)).isoformat()
            target_isos = {iso for _, iso in available if iso >= cutoff}

        # 篩選出目標日期（依時間順序由舊到新）
        to_scrape = [(raw, iso) for raw, iso in available if iso in target_isos]
        to_scrape.reverse()  # 由舊到新

        print(f"\n🏇 準備抓取 {len(to_scrape)} 個賽馬日...\n")

        # 載入現有資料（如果 --append）
        existing = {}
        if args.append and Path(args.output).exists():
            with open(args.output, encoding="utf-8") as f:
                data = json.load(f)
            existing = {d["date"]: d for d in data}
            print(f"   (已有 {len(existing)} 日資料，追加模式)\n")

        results = dict(existing)
        success = 0

        for i, (raw_date, iso_date) in enumerate(to_scrape, 1):
            if iso_date in results and not args.append:
                print(f"[{i}/{len(to_scrape)}] ⏭️ 跳過 {iso_date} (已有資料)")
                continue

            print(f"[{i}/{len(to_scrape)}] 抓取 {iso_date}...")
            day_data = await scrape_day(page, raw_date)

            if day_data:
                results[iso_date] = day_data
                success += 1
            else:
                print(f"  ⚠️  {iso_date} 無資料或非賽馬日")

            # 每 10 次儲存一次
            if success % 10 == 0 and success > 0:
                _save(results, args.output)
                print(f"   💾 已儲存 checkpoint ({success} 日)")

            await asyncio.sleep(DELAY_MS / 1000)

        await browser.close()

    # 最終儲存
    _save(results, args.output)
    print(f"\n✅ 完成！成功抓取 {success} 個賽馬日 → {args.output}")


def _save(results: dict, output_path: str):
    """儲存結果到 JSON，按日期排序"""
    sorted_data = sorted(results.values(), key=lambda x: x["date"])
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
