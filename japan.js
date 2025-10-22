// Japan Economic Dashboard Logic

class JapanDashboard {
    constructor() {
        this.indicators = ['nikkei', 'topix', 'usdjpy', 'jgb'];
        this.allData = {}; // Store all indicator data
        this.chartColors = {
            nikkei: '#DC143C',    // Crimson (Japan red)
            topix: '#FF6B6B',     // Light red
            usdjpy: '#4ECDC4',    // Turquoise
            jgb: '#95E1D3'        // Mint green
        };
        this.init();
    }

    init() {
        // Individual indicator time range controls
        document.querySelectorAll('.indicator-range').forEach(select => {
            select.addEventListener('change', (e) => {
                const indicator = e.target.getAttribute('data-indicator');
                this.filterAndPlotChart(indicator);
            });
        });

        // Load initial data for all indicators
        this.loadAllData();
    }

    /**
     * Calculate start date based on selected time range
     */
    getStartDate(range) {
        const today = new Date();
        const startDate = new Date();

        switch(range) {
            case '3m':
                startDate.setMonth(today.getMonth() - 3);
                break;
            case '6m':
                startDate.setMonth(today.getMonth() - 6);
                break;
            case '1y':
                startDate.setFullYear(today.getFullYear() - 1);
                break;
            case '5y':
                startDate.setFullYear(today.getFullYear() - 5);
                break;
            case '10y':
                startDate.setFullYear(today.getFullYear() - 10);
                break;
            case 'max':
                startDate.setFullYear(1950);
                break;
            default:
                startDate.setFullYear(today.getFullYear() - 1);
        }

        return startDate.toISOString().split('T')[0];
    }

    /**
     * Load data from local file for a specific indicator
     */
    async loadFromLocalFile(indicator) {
        const loadingEl = document.getElementById(`${indicator}-loading`);
        const errorEl = document.getElementById(`${indicator}-error`);
        const chartEl = document.getElementById(`${indicator}-chart`);

        try {
            // Show loading state
            loadingEl.style.display = 'block';
            loadingEl.textContent = 'Loading data...';
            errorEl.style.display = 'none';
            chartEl.innerHTML = ''; // Clear placeholder

            // Try to load directly from GitHub first
            let result;
            try {
                const ghResponse = await fetch(`data/${indicator}_data.json`);
                if (ghResponse.ok) {
                    const data = await ghResponse.json();
                    result = { success: true, data: data };
                    console.log(`${indicator} loaded directly from GitHub`);
                } else {
                    throw new Error('GitHub file not found');
                }
            } catch (ghError) {
                // Fallback to server if GitHub fails
                console.log(`${indicator} loading from server (GitHub failed)`);
                const response = await fetch(`${CONFIG.SERVER_URL}/api/data/${indicator}`);
                result = await response.json();
            }

            if (result.success && result.data) {
                // Data found in local file
                this.allData[indicator] = {
                    dates: result.data.dates,
                    values: result.data.values,
                    name: result.data.name
                };

                console.log(`${indicator} loaded from local file (last updated: ${result.data.lastUpdated})`);

                // Plot data based on current time range selection
                this.filterAndPlotChart(indicator);

                // Hide loading, show chart
                loadingEl.style.display = 'none';
                chartEl.style.display = 'block';
            } else {
                // No local file, need to fetch from API
                console.log(`No local data found for ${indicator}, fetching from API...`);
                await this.refreshData(indicator);
            }

        } catch (error) {
            console.error(`Error loading ${indicator} from local file:`, error);
            // If server is not running or error occurred, try to fetch from API
            console.log(`Falling back to API for ${indicator}...`);
            await this.refreshData(indicator);
        }
    }

    /**
     * Load all indicators from local files
     */
    async loadAllData() {
        for (const indicator of this.indicators) {
            await this.loadFromLocalFile(indicator);
        }
    }

    /**
     * Refresh data from API for a specific indicator
     */
    async refreshData(indicator) {
        const loadingEl = document.getElementById(`${indicator}-loading`);
        const errorEl = document.getElementById(`${indicator}-error`);
        const chartEl = document.getElementById(`${indicator}-chart`);

        try {
            // Show loading state
            loadingEl.style.display = 'block';
            loadingEl.textContent = 'Fetching data from API...';
            errorEl.style.display = 'none';
            chartEl.innerHTML = ''; // Clear placeholder

            // Fetch from API via server (which will also save locally)
            const response = await fetch(`${CONFIG.SERVER_URL}/api/data/${indicator}/refresh`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success && result.data) {
                // Store data
                this.allData[indicator] = {
                    dates: result.data.dates,
                    values: result.data.values,
                    name: result.data.name
                };

                console.log(`${indicator} refreshed from API and saved locally`);

                // Plot data based on current time range selection
                this.filterAndPlotChart(indicator);

                // Hide loading, show chart
                loadingEl.style.display = 'none';
                chartEl.style.display = 'block';
            } else {
                throw new Error(result.message || 'Failed to fetch data from API');
            }

        } catch (error) {
            console.error(`Error refreshing ${indicator} data:`, error);
            loadingEl.style.display = 'none';
            errorEl.textContent = `Error loading data: ${error.message}`;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Filter stored data based on time range and plot for a specific indicator
     */
    filterAndPlotChart(indicator) {
        if (!this.allData[indicator]) {
            console.warn(`No data available for ${indicator}`);
            return;
        }

        // Get time range from individual indicator selector
        const timeRangeElement = document.getElementById(`${indicator}-range`);
        if (!timeRangeElement) {
            console.warn(`No time range selector found for ${indicator}`);
            return;
        }

        const timeRange = timeRangeElement.value;
        const startDate = this.getStartDate(timeRange);

        // Filter data based on selected time range
        const filteredIndices = [];
        for (let i = 0; i < this.allData[indicator].dates.length; i++) {
            if (this.allData[indicator].dates[i] >= startDate) {
                filteredIndices.push(i);
            }
        }

        const filteredDates = filteredIndices.map(i => this.allData[indicator].dates[i]);
        const filteredValues = filteredIndices.map(i => this.allData[indicator].values[i]);

        // Log date range for debugging
        if (filteredDates.length > 0) {
            console.log(`${indicator} - Time range: ${timeRange}`);
            console.log(`${indicator} - Showing ${filteredDates.length} data points`);
            console.log(`${indicator} - Date range: ${filteredDates[0]} to ${filteredDates[filteredDates.length - 1]}`);
        }

        // Plot the filtered data
        this.plotChart(indicator, filteredDates, filteredValues);
    }

    /**
     * Plot chart using Plotly
     */
    plotChart(indicator, dates, values) {
        // Main line trace
        const lineTrace = {
            x: dates,
            y: values,
            type: 'scatter',
            mode: 'lines',
            name: this.allData[indicator].name || indicator,
            line: {
                color: this.chartColors[indicator] || '#666',
                width: 2
            },
            hovertemplate: '<b>Date:</b> %{x}<br>' +
                          '<b>Value:</b> %{y:.2f}<br>' +
                          '<extra></extra>'
        };

        // Most recent data point marker
        const lastPointTrace = {
            x: [dates[dates.length - 1]],
            y: [values[values.length - 1]],
            type: 'scatter',
            mode: 'markers',
            name: 'Latest',
            marker: {
                color: this.chartColors[indicator] || '#666',
                size: 10,
                symbol: 'circle',
                line: {
                    color: 'white',
                    width: 2
                }
            },
            hovertemplate: '<b>Latest</b><br>' +
                          '<b>Date:</b> %{x}<br>' +
                          '<b>Value:</b> %{y:.2f}<br>' +
                          '<extra></extra>',
            showlegend: false,
            hoverinfo: 'all'
        };

        // Calculate date range with padding
        const firstDate = new Date(dates[0]);
        const lastDate = new Date(dates[dates.length - 1]);
        const dateRange = lastDate - firstDate;
        const padding = dateRange * 0.05; // 5% padding on each side

        const layout = {
            title: {
                text: '',
                font: { size: 18 }
            },
            xaxis: {
                title: 'Date',
                showgrid: true,
                gridcolor: '#e0e0e0',
                rangeslider: { visible: false },
                type: 'date',
                range: [new Date(firstDate.getTime() - padding), new Date(lastDate.getTime() + padding)]
            },
            yaxis: {
                title: 'Value',
                showgrid: true,
                gridcolor: '#e0e0e0',
                autorange: true
            },
            hovermode: 'closest',
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: { t: 30, r: 30, b: 60, l: 60 },
            showlegend: false
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: `${indicator}_chart`,
                height: 600,
                width: 1000,
                scale: 2
            }
        };

        Plotly.newPlot(`${indicator}-chart`, [lineTrace, lastPointTrace], layout, config);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new JapanDashboard();
});
