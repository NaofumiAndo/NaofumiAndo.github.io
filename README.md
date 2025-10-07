# S&P 500 Economic Indicators Dashboard

A real-time dashboard for tracking economic indicators and S&P 500 data.

## Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd NaofumiAndo.github.io
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env` and fill in your API keys:
```bash
cp .env.example .env
```

Edit `.env` with your actual API keys:
- `FRED_API_KEY` - Get from [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html)
- `OPENAI_API_KEY` - Get from [OpenAI](https://platform.openai.com/api-keys)
- `GOOGLE_SEARCH_API_KEY` - Get from [Google Cloud Console](https://console.cloud.google.com/)
- `GOOGLE_SEARCH_ENGINE_ID` - Get from [Google Programmable Search Engine](https://programmablesearchengine.google.com/)
- `ADMIN_PASSWORD` - Set your own admin password

### 4. Configure admin password (frontend)
Copy `config.local.js.example` to `config.local.js`:
```bash
cp config.local.js.example config.local.js
```

Edit `config.local.js` and set your `ADMIN_PASSWORD` to match the one in `.env`

### 5. Run the server
```bash
node server.js
```

The server will run on `http://localhost:3000`

## Security

- **Never commit `.env` file** - It contains your sensitive API keys
- **Never commit `config.local.js` file** - It contains your admin password
- Both files are already in `.gitignore`
- Use `.env.example` and `config.local.js.example` as templates
- For production deployment, set environment variables on your hosting platform

## Deployment

When deploying to a platform like GitHub Pages, Vercel, or Netlify:
1. Set environment variables in your hosting platform's settings
2. Do not include the `.env` file in your deployment
3. The application will automatically use environment variables from the hosting platform
