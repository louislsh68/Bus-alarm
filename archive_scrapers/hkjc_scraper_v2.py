import json
import datetime
import time
import subprocess
import re
import sys

def run_command(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    return result.stdout

def web_fetch(url):
    cmd = ['openclaw', 'tool', 'web_fetch', '--url', url, '--extractMode', 'markdown']
    output = run_command(cmd)
    if output:
        try:
            return json.loads(output)
        except:
            return None
    return None

def parse_date(date_str):
    # Try to parse dd/mm/yyyy or yyyy/mm/dd
    for fmt in ('%d/%m/%Y', '%Y/%m/%d'):
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass
    return None

def extract_race_links(day_markdown):
    # Find links like /zh-hk/local/information/localresults?racedate=2026/03/11&Racecourse=HV&RaceNo=2
    links = re.findall(r"(/zh-hk/local/information/localresults\?racedate=.*?&RaceNo=(\d+))", day_markdown)
    # Deduplicate and sort
    seen = {}
    for link, no in links:
        seen[int(no)] = "https://racing.hkjc.com" + link
    return seen

def parse_race_results(markdown):
    # Header Info
    race_no_match = re.search(r"第 (\d+) 場", markdown)
    race_no = race_no_match.group(1) if race_no_match else "?"
    
    header_info = ""
    header_match = re.search(r"第 \d+ 場.*?\n\n(.*?)\n\n", markdown, re.S)
    if header_match:
        header_info = header_match.group(1).replace('\n', ' ')

    going_match = re.search(r"場地狀況 :\n\s*(.*?)\n", markdown)
    going = going_match.group(1).strip() if going_match else "?"
    
    course_match = re.search(r"賽道 :\n\s*(.*?)\n", markdown)
    course = course_match.group(1).strip() if course_match else "?"

    # Results table
    # Looking for the pattern: Rank, No, Horse, Jockey, Trainer, Weight, BodyWeight, Draw, Margin, [RunningPos], Time, Odds
    # We look for lines that look like horse rows.
    
    results = []
    # Split by double newlines and filter for lines that start with a number (Rank)
    lines = markdown.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Potential start of a row: a number or WV-A
        if re.match(r"^(\d+|WV-A|WX-A)$", line):
            # Try to grab the next ~12-15 non-empty lines
            row_data = [line]
            j = i + 1
            while j < len(lines) and len(row_data) < 13:
                val = lines[j].strip()
                if val and not val.startswith('[赛後須抽取樣本檢驗]') and not val.startswith('備註:'):
                    row_data.append(val)
                elif not val and len(row_data) >= 11: # End of row maybe?
                    break
                j += 1
            
            if len(row_data) >= 8: # Minimum fields
                results.append(row_data)
                i = j - 1
        i += 1

    return {
        "race_no": race_no,
        "header": header_info,
        "going": going,
        "course": course,
        "raw_results": results
    }

def scrape_day(date_obj):
    date_str = date_obj.strftime('%Y/%m/%d')
    url = f"https://racing.hkjc.com/zh-hk/local/information/localresults?racedate={date_str}"
    print(f"Fetching day summary: {url}")
    data = web_fetch(url)
    if not data or 'text' not in data:
        return None
    
    markdown = data['text']
    print("DEBUG: Markdown length:", len(markdown))
    print("DEBUG: Markdown preview:", markdown[:1000])
    race_links = extract_race_links(markdown)
    if not race_links:
        # Maybe it's a single race page or no races
        print("No race links found.")
        return None
    
    all_races = []
    for race_no in sorted(race_links.keys()):
        race_url = race_links[race_no]
        print(f"Fetching Race {race_no}: {race_url}")
        race_data = web_fetch(race_url)
        if race_data and 'text' in race_data:
            parsed = parse_race_results(race_data['text'])
            all_races.append(parsed)
        time.sleep(1) # Be nice
    
    return {
        "date": date_obj.isoformat(),
        "races": all_races
    }

if __name__ == "__main__":
    # Test for 08/03/2026
    target_date = datetime.date(2026, 3, 8)
    day_results = scrape_day(target_date)
    if day_results:
        with open('hkjc_results_test.json', 'w', encoding='utf-8') as f:
            json.dump(day_results, f, ensure_ascii=False, indent=2)
        print("Scraping completed. Saved to hkjc_results_test.json")
    else:
        print("Scraping failed.")
