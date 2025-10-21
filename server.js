// Simple Node.js server to handle file operations and API requests
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const yahooFinance = require('yahoo-finance2').default;
const { JSDOM } = require('jsdom');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Data file paths
const DATA_FILES = {
    sp500: path.join(DATA_DIR, 'sp500_data.json'),
    treasury: path.join(DATA_DIR, 'treasury_data.json'),
    oil: path.join(DATA_DIR, 'oil_data.json'),
    gold: path.join(DATA_DIR, 'gold_data.json'),
    dollar: path.join(DATA_DIR, 'dollar_data.json'),
    nikkei: path.join(DATA_DIR, 'nikkei_data.json'),
    topix: path.join(DATA_DIR, 'topix_data.json'),
    usdjpy: path.join(DATA_DIR, 'usdjpy_data.json'),
    jgb: path.join(DATA_DIR, 'jgb_data.json'),
    estimates: path.join(DATA_DIR, 'estimates.json'),
    news: path.join(DATA_DIR, 'sp500_news.json')
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// API Configuration - load from environment variables only
const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_API_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || '';
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Validate required API keys
if (!FRED_API_KEY) {
    console.warn('WARNING: FRED_API_KEY not set in environment variables');
}
if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('WARNING: Google Search API credentials not set in environment variables');
}
if (!ADMIN_PASSWORD) {
    console.warn('WARNING: ADMIN_PASSWORD not set in environment variables');
}

// Data source configuration
const DATA_SOURCES = {
    sp500: { type: 'fred', seriesId: 'SP500', name: 'S&P 500 Index' },
    treasury: { type: 'yahoo', symbol: 'IEF', name: 'iShares 7-10 Year Treasury Bond ETF' },
    oil: { type: 'fred', seriesId: 'DCOILWTICO', name: 'Crude Oil Prices: WTI' },
    gold: { type: 'yahoo', symbol: 'GC=F', name: 'Gold Futures' },
    dollar: { type: 'fred', seriesId: 'DTWEXAFEGS', name: 'Advanced Foreign Economies Dollar Index' },
    nikkei: { type: 'yahoo', symbol: '^N225', name: 'Nikkei 225 Index' },
    topix: { type: 'yahoo', symbol: '^TPX', name: 'TOPIX Index' },
    usdjpy: { type: 'yahoo', symbol: 'JPY=X', name: 'USD/JPY Exchange Rate' },
    jgb: { type: 'fred', seriesId: 'IRLTLT01JPM156N', name: 'Japanese Government Bond 10-Year Yield' }
};

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Admin authentication endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, message: 'Password required' });
        }

        if (password === ADMIN_PASSWORD) {
            // Generate a simple session token (in production, use JWT or proper sessions)
            const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
            res.json({
                success: true,
                message: 'Login successful',
                token: token
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Middleware to verify admin token (simple version)
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized - No token provided' });
    }

    const token = authHeader.substring(7);

    // Simple token validation (in production, use JWT)
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        if (decoded.startsWith('admin:')) {
            next();
        } else {
            res.status(401).json({ success: false, message: 'Unauthorized - Invalid token' });
        }
    } catch (error) {
        res.status(401).json({ success: false, message: 'Unauthorized - Invalid token' });
    }
}

// Helper function to fetch from FRED API
async function fetchFromFRED(seriesId, startDate = '1950-01-01') {
    const url = new URL(FRED_API_BASE_URL);
    url.searchParams.append('series_id', seriesId);
    url.searchParams.append('api_key', FRED_API_KEY);
    url.searchParams.append('file_type', 'json');
    url.searchParams.append('observation_start', startDate);

    const response = await fetch(url);

    // Handle rate limit
    if (response.status === 429) {
        throw new Error('FRED API rate limit exceeded (120 requests/minute). Please wait a moment.');
    }

    if (!response.ok) {
        throw new Error(`FRED API error! status: ${response.status}`);
    }

    const fredData = await response.json();
    const validData = fredData.observations.filter(obs => obs.value !== '.');

    return {
        dates: validData.map(obs => obs.date),
        values: validData.map(obs => parseFloat(obs.value))
    };
}

// Helper function to fetch from Yahoo Finance
async function fetchFromYahoo(symbol) {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 20); // Get 20 years of data

        const result = await yahooFinance.historical(symbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });

        if (!result || result.length === 0) {
            throw new Error(`No data returned from Yahoo Finance for ${symbol}`);
        }

        // Sort by date
        result.sort((a, b) => a.date - b.date);

        return {
            dates: result.map(item => item.date.toISOString().split('T')[0]),
            values: result.map(item => item.close)
        };
    } catch (error) {
        // Check for JSON parsing errors (usually indicates rate limiting)
        if (error.message && error.message.includes('Unexpected token')) {
            throw new Error('Yahoo Finance rate limit exceeded. Please wait 5-10 minutes and try again. Try refreshing indicators one at a time instead of all at once.');
        }
        // Check for rate limiting
        if (error.message && (error.message.includes('Too Many Requests') || error.message.includes('429'))) {
            throw new Error('Yahoo Finance rate limit exceeded. Please wait 5-10 minutes and try again.');
        }
        // Check for other common errors
        if (error.message && error.message.includes('Invalid symbol')) {
            throw new Error(`Invalid symbol: ${symbol}`);
        }
        // Re-throw with more context
        throw new Error(`Yahoo Finance error for ${symbol}: ${error.message}`);
    }
}

// Momentum comparison endpoint (MUST be before generic :indicator route)
app.get('/api/data/momentum', async (req, res) => {
    try {
        const indicators = ['sp500', 'treasury', 'oil', 'gold', 'dollar'];
        const momentumData = {};
        let successCount = 0;

        // Get baseline period from query parameter (default: 1m)
        const baselinePeriod = req.query.period || '1m';

        // Read all indicator data
        for (const indicator of indicators) {
            const filePath = DATA_FILES[indicator];
            try {
                const data = await fs.readFile(filePath, 'utf8');
                const jsonData = JSON.parse(data);

                console.log(`Processing ${indicator}: ${jsonData.dates.length} dates, baseline period: ${baselinePeriod}`);

                // Calculate momentum with specified baseline period
                const normalized = calculateMomentum(jsonData.dates, jsonData.values, baselinePeriod);

                console.log(`Normalized ${indicator}: ${normalized.dates.length} dates`);

                if (normalized.dates.length > 0) {
                    momentumData[indicator] = {
                        name: jsonData.name || DATA_SOURCES[indicator].name,
                        dates: normalized.dates,
                        values: normalized.values,
                        baselineDate: normalized.baselineDate
                    };
                    successCount++;
                } else {
                    console.log(`Warning: No normalized data for ${indicator}`);
                }
            } catch (error) {
                console.log(`No data available for ${indicator}: ${error.message}`);
            }
        }

        console.log(`Momentum data ready for ${successCount} indicators`);

        // Align all indicators to common dates
        if (successCount > 0) {
            // Find the common date range (intersection of all dates)
            const allDateSets = Object.values(momentumData).map(ind => new Set(ind.dates));
            const commonDates = [...allDateSets[0]].filter(date =>
                allDateSets.every(dateSet => dateSet.has(date))
            ).sort();

            console.log(`Common dates after alignment: ${commonDates.length}`);

            // Filter each indicator to only include common dates
            for (const indicator in momentumData) {
                const filtered = momentumData[indicator].dates.reduce((acc, date, idx) => {
                    if (commonDates.includes(date)) {
                        acc.dates.push(date);
                        acc.values.push(momentumData[indicator].values[idx]);
                    }
                    return acc;
                }, { dates: [], values: [] });

                momentumData[indicator].dates = filtered.dates;
                momentumData[indicator].values = filtered.values;
            }
        }

        res.json({
            success: successCount > 0,
            data: momentumData,
            count: successCount
        });

    } catch (error) {
        console.error('Error calculating momentum:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Month-over-month growth rate endpoint (MUST be before generic :indicator route)
app.get('/api/data/growth', async (req, res) => {
    try {
        const indicators = ['sp500', 'treasury', 'oil', 'gold', 'dollar'];
        const growthData = {};
        let successCount = 0;

        // Read all indicator data
        for (const indicator of indicators) {
            const filePath = DATA_FILES[indicator];
            try {
                const data = await fs.readFile(filePath, 'utf8');
                const jsonData = JSON.parse(data);

                console.log(`Calculating growth for ${indicator}: ${jsonData.dates.length} dates`);

                // Calculate month-over-month growth rates
                const growth = calculateMonthOverMonthGrowth(jsonData.dates, jsonData.values);

                console.log(`Growth calculation for ${indicator}: ${growth.dates.length} months`);

                if (growth.dates.length > 0) {
                    growthData[indicator] = {
                        name: jsonData.name || DATA_SOURCES[indicator].name,
                        dates: growth.dates,
                        values: growth.values
                    };
                    successCount++;
                } else {
                    console.log(`Warning: No growth data for ${indicator}`);
                }
            } catch (error) {
                console.log(`No data available for ${indicator}: ${error.message}`);
            }
        }

        console.log(`Growth data ready for ${successCount} indicators`);

        // Limit each indicator to its own last 24 months (don't force alignment)
        if (successCount > 0) {
            for (const indicator in growthData) {
                const dates = growthData[indicator].dates;
                const values = growthData[indicator].values;

                // Keep only last 24 months for each indicator
                if (dates.length > 24) {
                    growthData[indicator].dates = dates.slice(-24);
                    growthData[indicator].values = values.slice(-24);
                }

                console.log(`${indicator}: ${growthData[indicator].dates.length} months of growth data`);
            }
        }

        res.json({
            success: successCount > 0,
            data: growthData,
            count: successCount
        });

    } catch (error) {
        console.error('Error calculating growth:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Generic read local data file
app.get('/api/data/:indicator', async (req, res) => {
    const { indicator } = req.params;
    const filePath = DATA_FILES[indicator];

    if (!filePath) {
        return res.status(404).json({ success: false, message: 'Invalid indicator' });
    }

    try {
        const data = await fs.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        res.json({ success: true, data: jsonData, source: 'local' });
    } catch (error) {
        // File doesn't exist or can't be read
        res.json({ success: false, message: 'No local data available', source: 'none' });
    }
});

// Generic refresh data from API and save locally
app.post('/api/data/:indicator/refresh', async (req, res) => {
    const { indicator } = req.params;
    const config = DATA_SOURCES[indicator];
    const filePath = DATA_FILES[indicator];

    if (!config || !filePath) {
        return res.status(404).json({ success: false, message: 'Invalid indicator' });
    }
    try {
        console.log(`Fetching ${config.name} from ${config.type.toUpperCase()}...`);

        let fetchedData;
        if (config.type === 'fred') {
            fetchedData = await fetchFromFRED(config.seriesId);
        } else if (config.type === 'yahoo') {
            fetchedData = await fetchFromYahoo(config.symbol);
        } else {
            throw new Error('Unknown data source type');
        }

        // Prepare data structure
        const dataToSave = {
            lastUpdated: new Date().toISOString(),
            indicator: indicator,
            name: config.name,
            source: config.type,
            sourceId: config.seriesId || config.symbol,
            dates: fetchedData.dates,
            values: fetchedData.values
        };

        // Save to local file
        await ensureDataDir();
        await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));

        console.log(`${config.name} data saved successfully`);
        res.json({
            success: true,
            data: dataToSave,
            source: 'api',
            message: `Data fetched from ${config.type.toUpperCase()} and saved locally`
        });

    } catch (error) {
        console.error(`Error fetching/saving ${indicator} data:`, error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Helper function to calculate momentum with adjustable baseline period
function calculateMomentum(dates, values, period = '1m') {
    if (!dates || !values || dates.length === 0) {
        console.log('calculateMomentum: No dates or values provided');
        return { dates: [], values: [], baselineDate: null };
    }

    const today = new Date();
    let targetDate;

    // Calculate baseline date based on period
    switch(period) {
        case '1m':
            // Last day of the month before previous month (2 months ago)
            targetDate = new Date(today.getFullYear(), today.getMonth() - 1, 0);
            break;
        case '6m':
            // End of first month, 6 months ago
            targetDate = new Date(today.getFullYear(), today.getMonth() - 6, 0);
            break;
        case '1y':
            // End of first month, 1 year ago
            targetDate = new Date(today.getFullYear() - 1, today.getMonth(), 0);
            break;
        case '2y':
            // End of first month, 2 years ago
            targetDate = new Date(today.getFullYear() - 2, today.getMonth(), 0);
            break;
        case '3y':
            // End of first month, 3 years ago
            targetDate = new Date(today.getFullYear() - 3, today.getMonth(), 0);
            break;
        case '4y':
            // End of first month, 4 years ago
            targetDate = new Date(today.getFullYear() - 4, today.getMonth(), 0);
            break;
        case '5y':
            // End of first month, 5 years ago
            targetDate = new Date(today.getFullYear() - 5, today.getMonth(), 0);
            break;
        default:
            targetDate = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const baselineDate = targetDate.toISOString().split('T')[0];
    console.log(`Looking for baseline date (${period}): ${baselineDate}`);

    // Find the baseline value (closest date to or before last day of previous month)
    let baselineIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < dates.length; i++) {
        const currentDate = new Date(dates[i]);
        const targetDate = new Date(baselineDate);
        const diff = targetDate - currentDate; // positive if current is before target

        // Find the closest date that is on or before the baseline date
        if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            baselineIndex = i;
        }
    }

    console.log(`Baseline index found: ${baselineIndex} (out of ${dates.length} dates)`);

    // If no baseline found before the target date, find the closest date after
    if (baselineIndex === -1) {
        console.log('No date before baseline found, looking for closest after...');
        for (let i = 0; i < dates.length; i++) {
            const currentDate = new Date(dates[i]);
            const targetDate = new Date(baselineDate);
            const diff = Math.abs(currentDate - targetDate);

            if (diff < minDiff) {
                minDiff = diff;
                baselineIndex = i;
            }
        }
    }

    // If still no baseline found, return empty
    if (baselineIndex === -1 || baselineIndex >= dates.length) {
        console.log('Could not find valid baseline index');
        return { dates: [], values: [] };
    }

    const baselineValue = values[baselineIndex];
    console.log(`Baseline value at ${dates[baselineIndex]}: ${baselineValue}`);

    // Normalize all values from baseline onwards to baseline = 100
    const normalizedDates = [];
    const normalizedValues = [];

    for (let i = baselineIndex; i < dates.length; i++) {
        normalizedDates.push(dates[i]);
        normalizedValues.push((values[i] / baselineValue) * 100);
    }

    console.log(`Normalized ${normalizedDates.length} data points`);

    return {
        dates: normalizedDates,
        values: normalizedValues,
        baselineDate: dates[baselineIndex]
    };
}

// Helper function to calculate month-over-month growth rate
function calculateMonthOverMonthGrowth(dates, values) {
    if (!dates || !values || dates.length === 0) {
        console.log('calculateMonthOverMonthGrowth: No dates or values provided');
        return { dates: [], values: [] };
    }

    // Group data by month and get the last value of each month
    const monthlyData = {};

    for (let i = 0; i < dates.length; i++) {
        // Extract year-month directly from date string (YYYY-MM-DD format)
        const yearMonth = dates[i].substring(0, 7); // Gets 'YYYY-MM'

        // Keep the last value for each month (since dates are sorted, just overwrite)
        if (!monthlyData[yearMonth] || dates[i] > monthlyData[yearMonth].date) {
            monthlyData[yearMonth] = {
                date: dates[i],
                value: values[i]
            };
        }
    }

    // Sort by year-month
    const sortedMonths = Object.keys(monthlyData).sort();

    console.log(`Found ${sortedMonths.length} months of data`);

    // Calculate month-over-month growth rates
    const growthDates = [];
    const growthValues = [];

    for (let i = 1; i < sortedMonths.length; i++) {
        const currentMonth = sortedMonths[i];
        const previousMonth = sortedMonths[i - 1];

        const currentValue = monthlyData[currentMonth].value;
        const previousValue = monthlyData[previousMonth].value;

        // Calculate percentage change
        const growthRate = ((currentValue - previousValue) / previousValue) * 100;

        // Format date as "MMM YYYY" (e.g., "Aug 2025")
        const [year, month] = currentMonth.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${monthNames[parseInt(month) - 1]} ${year}`;

        growthDates.push(formattedDate);
        growthValues.push(growthRate);
    }

    console.log(`Calculated ${growthValues.length} month-over-month growth rates`);

    return {
        dates: growthDates,
        values: growthValues
    };
}

// Submit estimate endpoint (no auth required - public can submit)
app.post('/api/estimates/submit', async (req, res) => {
    try {
        const { name, estimates } = req.body;

        if (!name || !estimates) {
            return res.status(400).json({ success: false, message: 'Name and estimates are required' });
        }

        // Read existing estimates
        let allEstimates = [];
        try {
            const data = await fs.readFile(DATA_FILES.estimates, 'utf8');
            allEstimates = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, start with empty array
            allEstimates = [];
        }

        // Add new estimate
        const newEstimate = {
            id: Date.now(),
            name: name,
            timestamp: new Date().toISOString(),
            estimates: estimates
        };

        allEstimates.push(newEstimate);

        // Keep only last 100 submissions
        if (allEstimates.length > 100) {
            allEstimates = allEstimates.slice(-100);
        }

        // Save to file
        await ensureDataDir();
        await fs.writeFile(DATA_FILES.estimates, JSON.stringify(allEstimates, null, 2));

        console.log(`New estimate submitted by ${name}`);
        res.json({ success: true, message: 'Estimate submitted successfully', data: newEstimate });

    } catch (error) {
        console.error('Error submitting estimate:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all estimates endpoint
app.get('/api/estimates', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILES.estimates, 'utf8');
        const allEstimates = JSON.parse(data);
        res.json({ success: true, data: allEstimates });
    } catch (error) {
        // File doesn't exist yet
        res.json({ success: true, data: [] });
    }
});

// Delete estimate endpoint (public - anyone can delete)
app.delete('/api/estimates/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Read existing estimates
        let allEstimates = [];
        try {
            const data = await fs.readFile(DATA_FILES.estimates, 'utf8');
            allEstimates = JSON.parse(data);
        } catch (error) {
            return res.json({ success: false, message: 'No estimates found' });
        }

        // Filter out the estimate to delete
        const filteredEstimates = allEstimates.filter(est => est.id !== parseInt(id));

        if (filteredEstimates.length === allEstimates.length) {
            return res.json({ success: false, message: 'Estimate not found' });
        }

        // Save updated list
        await fs.writeFile(DATA_FILES.estimates, JSON.stringify(filteredEstimates, null, 2));

        console.log(`Estimate ${id} deleted`);
        res.json({ success: true, message: 'Estimate deleted successfully' });

    } catch (error) {
        console.error('Error deleting estimate:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get S&P 500 news
app.get('/api/news/sp500', async (req, res) => {
    try {
        const newsData = await fs.readFile(DATA_FILES.news, 'utf8');
        const news = JSON.parse(newsData);
        res.json({ success: true, data: news });
    } catch (error) {
        // If file doesn't exist, return empty lists
        res.json({
            success: true,
            data: {
                bullish: [],
                bearish: [],
                lastUpdated: null,
                estimatedCost: 0
            }
        });
    }
});

// Collect S&P 500 news using Google Custom Search (admin only)
app.post('/api/news/collect', verifyAdmin, async (req, res) => {
    try {
        if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
            return res.status(400).json({
                success: false,
                message: 'Google Search API key or Engine ID not configured. Please add them to config.js.'
            });
        }

        console.log('Collecting S&P 500 news articles from Google...');

        const dateRestrict = `d7`; // Last 7 days

        // Search for bullish articles
        const bullishQuery = 'S&P 500 bullish';
        console.log('Searching for bullish articles:', bullishQuery);

        const bullishResponse = await fetch(
            `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(bullishQuery)}&num=5&dateRestrict=${dateRestrict}&sort=date`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!bullishResponse.ok) {
            const error = await bullishResponse.text();
            throw new Error(`Google API error (bullish): ${error}`);
        }

        const bullishData = await bullishResponse.json();
        console.log(`Found ${bullishData.items?.length || 0} bullish articles`);

        // Search for bearish articles
        const bearishQuery = 'S&P 500 bearish';
        console.log('Searching for bearish articles:', bearishQuery);

        const bearishResponse = await fetch(
            `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(bearishQuery)}&num=5&dateRestrict=${dateRestrict}&sort=date`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!bearishResponse.ok) {
            const error = await bearishResponse.text();
            throw new Error(`Google API error (bearish): ${error}`);
        }

        const bearishData = await bearishResponse.json();
        console.log(`Found ${bearishData.items?.length || 0} bearish articles`);

        // Combine results
        const allArticles = [];

        // Process bullish articles
        if (bullishData.items && bullishData.items.length > 0) {
            bullishData.items.slice(0, 5).forEach(item => {
                allArticles.push({
                    url: item.link,
                    title: item.title,
                    source: item.displayLink || 'Unknown',
                    date: new Date().toISOString().split('T')[0],
                    sentiment: 'bullish'
                });
            });
        }

        // Process bearish articles
        if (bearishData.items && bearishData.items.length > 0) {
            bearishData.items.slice(0, 5).forEach(item => {
                allArticles.push({
                    url: item.link,
                    title: item.title,
                    source: item.displayLink || 'Unknown',
                    date: new Date().toISOString().split('T')[0],
                    sentiment: 'bearish'
                });
            });
        }

        console.log(`Total articles collected: ${allArticles.length}`);

        if (allArticles.length === 0) {
            throw new Error('No articles found from Google search');
        }

        // Categorize articles
        const bullish = allArticles.filter(a => a.sentiment === 'bullish');
        const bearish = allArticles.filter(a => a.sentiment === 'bearish');

        // Save to file
        const newsData = {
            bullish,
            bearish,
            lastUpdated: new Date().toISOString(),
            totalCost: 0 // No OpenAI cost
        };

        await fs.writeFile(DATA_FILES.news, JSON.stringify(newsData, null, 2));

        console.log(`Successfully saved ${allArticles.length} articles to file`);

        res.json({
            success: true,
            message: `Successfully collected ${allArticles.length} articles (${bullish.length} bullish, ${bearish.length} bearish)`,
            data: newsData
        });

    } catch (error) {
        console.error('Error collecting news:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reset news cost counter (admin only)
app.post('/api/news/reset-cost', verifyAdmin, async (req, res) => {
    try {
        const newsData = await fs.readFile(DATA_FILES.news, 'utf8');
        const news = JSON.parse(newsData);
        news.totalCost = 0;
        await fs.writeFile(DATA_FILES.news, JSON.stringify(news, null, 2));
        res.json({ success: true, message: 'Cost counter reset to $0.00' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Start server
app.listen(PORT, async () => {
    await ensureDataDir();
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});