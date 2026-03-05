# Updated Configuration for Daily Financial AI & Digital Assets News Search

## Cron Job Settings (ID: 8b787707-8559-476a-8ab4-cf299af10bd2)

### Schedule
- Time: 0 8 * * 1-5 (Every weekday at 8:00 AM)
- Enabled: true

### Search Parameters
- Prioritize Chinese-language sources from Hong Kong first
- Include international developments from Singapore, Japan, EU, and US
- Use freshness: pd (past day) to ensure latest results
- Minimum 4 news items per category (AI-related and Digital Assets-related)
- Each news item must have a verifiable source with direct URL
- Do not include general observations or summaries without specific sources

### Keywords
#### Chinese
- '金融', '銀行', '監管', '虛擬資產服務提供者', '證監會'
- 'AI', '人工智慧', '數碼資產', '區塊鏈', '代幣化', '穩定幣'
- '證券及期貨事務監察委員會'

#### English
- 'financial', 'banking', 'regulation', 'VASP', 'virtual asset service provider'
- 'SFC', 'Securities and Futures Commission', 'AI', 'artificial intelligence'
- 'crypto', 'blockchain', 'tokenization'

### Delivery
- Channel: telegram
- Format: Organized into AI-related and Digital Assets-related categories
- Each item includes source citation and direct link