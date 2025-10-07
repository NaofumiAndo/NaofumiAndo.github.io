# News Collection Feature Setup

## Overview
The news collection feature uses OpenAI's GPT-3.5-turbo API to find and categorize recent S&P 500 news articles that predict future price movements.

## Setup Instructions

### 1. Get an OpenAI API Key
1. Go to https://platform.openai.com/
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it starts with `sk-`)

### 2. Set the API Key as Environment Variable

**On Windows:**
```bash
set OPENAI_API_KEY=your-api-key-here
node server.js
```

Or for persistent setup:
1. Search for "Environment Variables" in Windows
2. Click "Edit the system environment variables"
3. Click "Environment Variables"
4. Under "User variables", click "New"
5. Variable name: `OPENAI_API_KEY`
6. Variable value: your API key
7. Restart your terminal/command prompt

**On Mac/Linux:**
```bash
export OPENAI_API_KEY=your-api-key-here
node server.js
```

Or add to your `.bashrc` or `.zshrc`:
```bash
echo 'export OPENAI_API_KEY=your-api-key-here' >> ~/.bashrc
source ~/.bashrc
```

### 3. Cost Safety Features

The system includes built-in safety features:

1. **$1.00 Cost Limit**: The system will automatically stop collecting news once $1.00 in API credits has been spent
2. **Cost Tracking**: Each request shows the individual cost and running total
3. **Manual Reset**: Admins can reset the cost counter if needed (future feature)

### 4. How to Use

1. Start the server with the API key set:
   ```bash
   node server.js
   ```

2. Open the dashboard in your browser

3. Log in as admin (click "Admin Login" button, default password: `admin123`)

4. Scroll to the S&P 500 Index section

5. Click the "Collect News" button (only visible in admin mode)

6. Wait for the API to collect and categorize news articles

7. Articles will be displayed in two categories:
   - 📈 **Bullish Outlook**: Articles predicting price increases
   - 📉 **Bearish Outlook**: Articles predicting price decreases

### 5. Cost Estimates

Using GPT-3.5-turbo:
- Input tokens: ~$0.0015 per 1,000 tokens
- Output tokens: ~$0.002 per 1,000 tokens
- Estimated cost per collection: ~$0.01-0.02
- You can collect news approximately 50-100 times before hitting the $1.00 limit

### 6. Troubleshooting

**"OpenAI API key not configured" error:**
- Make sure you set the `OPENAI_API_KEY` environment variable
- Restart the server after setting the variable
- Verify the key is correct (starts with `sk-`)

**"Cost limit reached" error:**
- You've spent $1.00 in API credits
- The cost counter needs to be reset (contact developer)
- Or increase the limit in `server.js` line 609

**No articles showing:**
- The news section will be empty until you collect news for the first time
- Click "Collect News" in admin mode to fetch articles

## Note on News Quality

The OpenAI API may not always return real, current URLs. For production use, consider integrating with a dedicated news API like:
- NewsAPI (https://newsapi.org/)
- Finnhub (https://finnhub.io/)
- Alpha Vantage (https://www.alphavantage.co/)

The current implementation asks OpenAI to provide real URLs, but results may vary.
