#!/bin/bash
# HKJC 賽馬日自動分析 + 發送 Telegram
DATE=$(date +%Y-%m-%d)
PYTHON=/opt/homebrew/bin/python3
SCRIPT=/Users/clawd/.openclaw/workspace/hkjc_race_day_analysis.py

# 執行分析，輸出存入臨時檔
OUTPUT=$($PYTHON $SCRIPT $DATE --no-send 2>/dev/null)

# 用 openclaw 發送 Telegram
echo "$OUTPUT" | head -c 4000 | openclaw message send --channel telegram --to 118380703
