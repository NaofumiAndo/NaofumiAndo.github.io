#!/usr/bin/env node

// Standalone script to fetch and update S&P 500 news
// This runs in GitHub Actions without needing the full server

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

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

// Fetch news from SerpAPI
async function fetchNews() {
    console.log('🔍 Fetching news from SerpAPI...');

    if (!SERPAPI_API_KEY) {
        throw new Error('SERPAPI_API_KEY not set in environment variables');
    }

    const query = 'S&P 500';

    // Calculate date range (1 week ago)
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    const afterDate = oneWeekAgo.toISOString().split('T')[0];
    const beforeDate = today.toISOString().split('T')[0];

    console.log(`   Query: ${query}`);
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

            // Stop after collecting 10 articles
            if (articles.length >= 10) {
                break;
            }
        }
    } else {
        console.log('   ⚠️  No news results found');
    }

    return articles;
}

// Main function
async function main() {
    console.log('📰 Starting news update...');
    console.log(`📅 ${new Date().toISOString()}\n`);

    try {
        await ensureDataDir();

        const articles = await fetchNews();

        const newsData = {
            articles,
            lastUpdated: new Date().toISOString()
        };

        await fs.writeFile(NEWS_FILE, JSON.stringify(newsData, null, 2));

        console.log('\n' + '='.repeat(60));
        console.log('✨ News update complete!');
        console.log(`   Collected ${articles.length} articles from reliable sources`);
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
