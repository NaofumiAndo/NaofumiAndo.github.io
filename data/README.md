# Data Directory

This folder contains market data files that persist across deployments.

## Files:
- `sp500_data.json` - S&P 500 Index historical data
- `treasury_data.json` - Long-Duration Treasury ETF (TLT) data
- `oil_data.json` - Crude Oil Prices (WTI) data
- `gold_data.json` - Gold Futures data
- `dollar_data.json` - Dollar Index data
- `estimates.json` - User-submitted market estimates
- `sp500_news.json` - Collected news articles

## Updating Data:
1. Login as admin on the website
2. Click "Refresh Data" for each indicator
3. The data files on Render will be updated
4. To persist changes permanently, commit the updated files to GitHub

## Data Sources:
- FRED API (Federal Reserve Economic Data)
- Yahoo Finance API
- Google Custom Search API
