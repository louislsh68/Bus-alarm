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
    # Using openclaw exec wrapper for web_fetch
    cmd = ['openclaw', 'tool', 'web_fetch', '--url', url, '--extractMode', 'markdown']
    output = run_command(cmd)
    if output:
        try:
            return json.loads(output)
        except:
            return None
    return None

def get_available_dates():
    # Fetch the main results page to get the date list
    url = "https://racing.hkjc.com/zh-hk/local/information/localresults"
    data = web_fetch(url)
    if not data or 'text' not in data:
        return []
    
    # Extract dates like 11/03/2026 from the options
    # The markdown shows them in a list or combobox format
    dates = re.findall(r'option "(\d{2}/\d{2}/\d{4})"', data['text'])
    return dates

def get_race_links(date_str):
    # Convert 11/03/2026 to 2026/03/11
    parts = date_str.split('/')
    formatted_date = f"{parts[2]}/{parts[1]}/{parts[0]}"
    url = f"https://racing.hkjc.com/zh-hk/local/information/localresults?racedate={formatted_date}"
    
    data = web_fetch(url)
    if not data or 'text' not in data:
        return []
    
    # Find links like /zh-hk/local/information/localresults?racedate=2026/03/08&Racecourse=ST&RaceNo=1
    links = re.findall(r'(/zh-hk/local/information/localresults\?racedate=.*?&Racecourse=.*?&RaceNo=\d+)', data['text'])
    full_links = ["https://racing.hkjc.com" + l for l in links]
    # Deduplicate while preserving order
    seen = set()
    unique_links = []
    for l in full_links:
        if l not in seen:
            unique_links.append(l)
            seen.add(l)
    return unique_links

def parse_single_race(url):
    print(f"Parsing: {url}")
    data = web_fetch(url)
    if not data or 'text' not in data:
        return None
    
    markdown = data['text']
    
    # Extract Race No and Info
    race_no_match = re.search(r"第 (\d+) 場", markdown)
    race_no = race_no_match.group(1) if race_no_match else "?"
    
    # Simple table parser for the performance table
    # It usually looks like: Rank | Horse No | Horse Name | Jockey | Trainer | Weight | BodyWeight | Draw | Margin | Pos | Time | Odds
    results = []
    lines = markdown.split('\n')
    
    # Search for the start of the table "名次"
    start_index = -1
    for idx, line in enumerate(lines):
        if "名次" in line and "馬號" in line and "馬名" in line:
            start_index = idx + 1
            break
            
    if start_index == -1:
        return None

    # Parse rows until a blank line or non-result line
    for i in range(start_index, len(lines)):
        line = lines[i].strip()
        if not line: continue
        
        # A result row starts with a rank (number) or special code (WV-A etc)
        if re.match(r'^(\d+|WV-A|WX-A)$', line):
            # Collect fields for this row
            row_fields = [line]
            j = i + 1
            while j < len(lines) and len(row_fields) < 12:
                field = lines[j].strip()
                if field:
                    row_fields.append(field)
                j += 1
            
            if len(row_fields) >= 8:
                results.append({
                    "rank": row_fields[0],
                    "horse_no": row_fields[1],
                    "horse_name": row_fields[2],
                    "jockey": row_fields[3],
                    "trainer": row_fields[4],
                    "actual_weight": row_fields[5],
                    "body_weight": row_fields[6],
                    "draw": row_fields[7],
                    "margin": row_fields[8] if len(row_fields) > 8 else "",
                    "running_pos": row_fields[9] if len(row_fields) > 9 else "",
                    "finish_time": row_fields[10] if len(row_fields) > 10 else "",
                    "win_odds": row_fields[11] if len(row_fields) > 11 else ""
                })
                i = j - 1
        elif "派彩" in line or "彩池" in line:
            break # End of results table
            
    return {
        "url": url,
        "race_no": race_no,
        "results": results
    }

if __name__ == "__main__":
    dates = get_available_dates()
    print(f"Available dates: {dates[:5]} ...")
    
    if dates:
        # Test with the most recent full day (e.g., the second one if the first is today)
        test_date = dates[1] if len(dates) > 1 else dates[0]
        print(f"Testing with date: {test_date}")
        
        race_links = get_race_links(test_date)
        print(f"Found {len(race_links)} races.")
        
        day_data = {"date": test_date, "races": []}
        for link in race_links:
            race_res = parse_single_race(link)
            if race_res:
                day_data["races"].append(race_res)
            time.sleep(0.5)
            
        with open(f"hkjc_day_{test_date.replace('/','-')}.json", "w", encoding="utf-8") as f:
            json.dump(day_data, f, ensure_ascii=False, indent=2)
        print("Done.")
