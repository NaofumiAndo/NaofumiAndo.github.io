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

This project has two parts:
1. **Frontend** - Deploy to GitHub Pages (static site)
2. **Backend** - Deploy to Render.com (Node.js API server)

### Deploy Backend to Render.com

1. **Create a Render account** at [render.com](https://render.com)

2. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

3. **Configure the service**:
   - Name: `naofumiando-api` (or any name you want)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Instance Type: `Free`

4. **Add Environment Variables** in Render dashboard:
   - `FRED_API_KEY` - Your FRED API key
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `GOOGLE_SEARCH_API_KEY` - Your Google Search API key
   - `GOOGLE_SEARCH_ENGINE_ID` - Your Google Search Engine ID
   - `ADMIN_PASSWORD` - Your admin password

5. **Deploy** - Render will automatically deploy your backend

6. **Copy your Render URL** - It will be like `https://naofumiando-api.onrender.com`

### Update Frontend Configuration

After deploying the backend:

1. Update `config.js` with your Render URL:
```javascript
const CONFIG = {
    SERVER_URL: 'https://naofumiando-api.onrender.com',  // Your Render URL here
    ADMIN_PASSWORD: 'your_password'
};
```

2. Commit and push to GitHub:
```bash
git add config.js
git commit -m "Update server URL to Render backend"
git push
```

3. GitHub Pages will automatically update with the new configuration

### Note on Free Tier
Render's free tier spins down after 15 minutes of inactivity. The first request after inactivity may take 30-60 seconds to wake up the server.

### Data Persistence
Data files (market data, estimates, news) are stored in the `/data` folder and committed to GitHub. This ensures:
- Data persists across Render deployments
- Data is backed up in version control
- No data loss when the server restarts

**After updating data as admin:**
1. Data is automatically saved to the `/data` folder on Render
2. To persist changes, pull the updated data files from Render and commit them:
   ```bash
   # Option A: Manually download from Render and commit
   # Or Option B: Set up automatic commits (advanced)
   ```

**Note:** On Render's free tier, the file system is ephemeral. Data updated through the admin panel will be lost when:
- The service is redeployed
- The service restarts after inactivity

To keep data permanently, commit the updated data files from the `/data` folder to GitHub after making changes.
