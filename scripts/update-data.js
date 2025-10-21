#!/usr/bin/env node

// Standalone script to fetch and update market data
// This runs in GitHub Actions without needing the full server

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const yahooFinance = require('yahoo-finance2').default;

const DATA_DIR = path.join(__dirname, '..', 'data');

// Data source configuration
const DATA_SOURCES = {
    sp500: { type: 'yahoo', symbol: '^GSPC', name: 'S&P 500 Index' },
    treasury: { type: 'yahoo', symbol: 'IEF', name: 'iShares 7-10 Year Treasury Bond ETF' },
    oil: { type: 'fred', seriesId: 'DCOILWTICO', name: 'Crude Oil Prices: WTI' },
    gold: { type: 'yahoo', symbol: 'GC=F', name: 'Gold Futures' },
    dollar: { type: 'fred', seriesId: 'DTWEXAFEGS', name: 'Advanced Foreign Economies Dollar Index' },
    nikkei: { type: 'yahoo', symbol: '^N225', name: 'Nikkei 225 Index' },
    topix: { type: 'yahoo', symbol: '1306.T', name: 'TOPIX ETF' },
    usdjpy: { type: 'yahoo', symbol: 'JPY=X', name: 'USD/JPY Exchange Rate' },
    jgb: { type: 'fred', seriesId: 'IRLTLT01JPM156N', name: 'Japanese Government Bond 10-Year Yield' }
};

const FRED_API_KEY = process.env.FRED_API_KEY;
const FRED_API_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

// Helper function to fetch from FRED API
async function fetchFromFRED(seriesId, startDate = '1950-01-01') {
    const url = new URL(FRED_API_BASE_URL);
    url.searchParams.append('series_id', seriesId);
    url.searchParams.append('api_key', FRED_API_KEY);
    url.searchParams.append('file_type', 'json');
    url.searchParams.append('observation_start', startDate);

    const response = await fetch(url);

    if (response.status === 429) {
        throw new Error('FRED API rate limit exceeded');
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
}

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Update a single indicator
async function updateIndicator(indicator, config) {
    console.log(`\nFetching ${config.name}...`);

    try {
        let fetchedData;

        if (config.type === 'fred') {
            if (!FRED_API_KEY) {
                console.log(`⚠️  Skipping ${indicator} - FRED_API_KEY not set`);
                return false;
            }
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

        // Save to file
        const filePath = path.join(DATA_DIR, `${indicator}_data.json`);
        await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));

        console.log(`✅ ${config.name} updated successfully (${fetchedData.dates.length} data points)`);
        console.log(`   Latest: ${fetchedData.dates[fetchedData.dates.length - 1]} = ${fetchedData.values[fetchedData.values.length - 1]}`);

        return true;
    } catch (error) {
        console.error(`❌ Error updating ${indicator}:`, error.message);
        return false;
    }
}

// Main function
async function main() {
    console.log('🚀 Starting data update...');
    console.log(`📅 ${new Date().toISOString()}\n`);

    await ensureDataDir();

    let successCount = 0;
    let failCount = 0;

    // Update all indicators with delays to avoid rate limiting
    for (const [indicator, config] of Object.entries(DATA_SOURCES)) {
        const success = await updateIndicator(indicator, config);

        if (success) {
            successCount++;
        } else {
            failCount++;
        }

        // Add delay between requests to avoid rate limiting
        if (Object.keys(DATA_SOURCES).indexOf(indicator) < Object.keys(DATA_SOURCES).length - 1) {
            console.log('⏳ Waiting 3 seconds before next request...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Update complete!`);
    console.log(`   Success: ${successCount}/${Object.keys(DATA_SOURCES).length}`);
    console.log(`   Failed: ${failCount}/${Object.keys(DATA_SOURCES).length}`);
    console.log('='.repeat(60));

    // Exit with error code if any updates failed
    process.exit(failCount > 0 ? 1 : 0);
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
