#!/usr/bin/env node

// Standalone script to fetch and update news for all indicators
// This runs in GitHub Actions without needing the full server

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

// Indicator search queries
const INDICATORS = {
    sp500: 'S&P 500',
    treasury: 'US treasury',
    oil: 'oil price',
    gold: 'gold price',
    dollar: 'USD'
};

// Allowed media sources
const ALLOWED_SOURCES = [
    'reuters.com',
    'bloomberg.com',
    'ft.com',
    'wsj.com',
    'nytimes.com',
    'fortune.com',
    'barrons.com',
    'finance.yahoo.com',
    'cnbc.com',
    'marketwatch.com',
    'seekingalpha.com',
    'investopedia.com'
];

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Fetch news from SerpAPI for a specific query
async function fetchNewsForQuery(query, maxArticles = 5) {
    console.log(`🔍 Fetching news for "${query}"...`);

    if (!SERPAPI_API_KEY) {
        throw new Error('SERPAPI_API_KEY not set in environment variables');
    }

    // Calculate date range (1 week ago)
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    const afterDate = oneWeekAgo.toISOString().split('T')[0];
    const beforeDate = today.toISOString().split('T')[0];

    console.log(`   Date range: ${afterDate} to ${beforeDate}`);

    // SerpAPI Google News request
    const url = new URL('https://serpapi.com/search');
    url.searchParams.append('engine', 'google_news');
    url.searchParams.append('q', query);
    url.searchParams.append('api_key', SERPAPI_API_KEY);
    url.searchParams.append('gl', 'us');
    url.searchParams.append('hl', 'en');
    url.searchParams.append('tbs', `cdr:1,cd_min:${afterDate.replace(/-/g, '/')},cd_max:${beforeDate.replace(/-/g, '/')}`);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`SerpAPI error! status: ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
        throw new Error(`SerpAPI error: ${data.error}`);
    }

    // Process and filter articles
    const articles = [];
    if (data.news_results && data.news_results.length > 0) {
        console.log(`   Found ${data.news_results.length} total results`);

        for (const item of data.news_results) {
            // Extract domain from URL
            let domain = '';
            try {
                const urlObj = new URL(item.link);
                domain = urlObj.hostname.replace('www.', '');
            } catch (e) {
                console.log(`   ⚠️  Skipping invalid URL: ${item.link}`);
                continue;
            }

            // Check if domain is in allowed sources
            const isAllowed = ALLOWED_SOURCES.some(allowedDomain =>
                domain === allowedDomain || domain.endsWith('.' + allowedDomain)
            );

            if (isAllowed) {
                articles.push({
                    url: item.link,
                    title: item.title,
                    source: item.source?.name || domain,
                    date: item.date || new Date().toISOString().split('T')[0],
                    snippet: item.snippet || ''
                });

                console.log(`   ✅ ${item.source?.name || domain}: ${item.title.substring(0, 60)}...`);
            } else {
                console.log(`   ⏭️  Filtered out ${domain}`);
            }

            // Stop after collecting requested number of articles
            if (articles.length >= maxArticles) {
                break;
            }
        }
    } else {
        console.log('   ⚠️  No news results found');
    }

    console.log(`   Collected ${articles.length} articles\n`);
    return articles;
}

// Add delay between API calls to avoid rate limiting
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function main() {
    console.log('📰 Starting news update for all indicators...');
    console.log(`📅 ${new Date().toISOString()}\n`);

    try {
        await ensureDataDir();

        const newsData = {
            sp500: [],
            treasury: [],
            oil: [],
            gold: [],
            dollar: [],
            lastUpdated: new Date().toISOString()
        };

        // Fetch news for each indicator with delay between requests
        for (const [indicator, query] of Object.entries(INDICATORS)) {
            try {
                newsData[indicator] = await fetchNewsForQuery(query, 5);

                // Add 2 second delay between requests to avoid rate limiting
                if (indicator !== 'dollar') { // Don't delay after last request
                    console.log('⏳ Waiting 2 seconds before next request...\n');
                    await delay(2000);
                }
            } catch (error) {
                console.error(`   ❌ Error fetching news for ${indicator}: ${error.message}`);
                newsData[indicator] = []; // Set empty array on error
            }
        }

        await fs.writeFile(NEWS_FILE, JSON.stringify(newsData, null, 2));

        const totalArticles = Object.values(newsData).reduce((sum, articles) => {
            return sum + (Array.isArray(articles) ? articles.length : 0);
        }, 0);

        console.log('\n' + '='.repeat(60));
        console.log('✨ News update complete!');
        console.log(`   Total articles collected: ${totalArticles}`);
        console.log(`   - S&P 500: ${newsData.sp500.length} articles`);
        console.log(`   - Treasury: ${newsData.treasury.length} articles`);
        console.log(`   - Oil: ${newsData.oil.length} articles`);
        console.log(`   - Gold: ${newsData.gold.length} articles`);
        console.log(`   - Dollar: ${newsData.dollar.length} articles`);
        console.log(`   Saved to: ${NEWS_FILE}`);
        console.log('='.repeat(60));

        process.exit(0);

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ News update failed!');
        console.error(`   Error: ${error.message}`);
        console.error('='.repeat(60));
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
