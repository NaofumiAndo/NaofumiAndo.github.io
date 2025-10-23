// Main application logic for Economic Charts Dashboard

class EconomicDashboard {
    constructor() {
        this.indicators = ['sp500', 'treasury', 'oil', 'gold', 'dollar'];
        this.allData = {}; // Store all indicator data
        this.momentumData = null; // Store raw momentum data
        this.growthData = null; // Store raw growth data
        this.isAdmin = false; // Track admin status
        this.adminToken = null; // Store authentication token
        this.chartColors = {
            sp500: '#2E7D32',
            treasury: '#1976D2',
            oil: '#D84315',
            gold: '#F9A825',
            dollar: '#6A1B9A'
        };
        this.compactNames = {
            sp500: 'S&P 500',
            treasury: 'Treasury 7-10Y',
            oil: 'Oil (WTI)',
            gold: 'Gold',
            dollar: 'Dollar Index'
        };
        this.init();
    }

    init() {
        // Momentum chart controls
        document.getElementById('momentum-baseline').addEventListener('change', () => this.loadMomentumChart());

        // Growth chart time control
        document.getElementById('growth-months').addEventListener('change', () => this.filterAndPlotGrowth());

        // Estimate submission
        document.getElementById('submit-estimate').addEventListener('click', () => this.submitEstimate());

        // Individual indicator time range controls
        document.querySelectorAll('.indicator-range').forEach(select => {
            select.addEventListener('change', (e) => {
                const indicator = e.target.getAttribute('data-indicator');
                this.filterAndPlotChart(indicator);
            });
        });

        // Load initial data for all indicators
        this.loadAllData();

        // Load momentum chart
        this.loadMomentumChart();

        // Load growth rate chart
        this.loadGrowthChart();

        // Load existing estimates
        this.loadEstimates();

        // Load news articles
        this.loadNews();
    }

    /**
     * Calculate start date based on selected time range
     */
    getStartDate(range) {
        const today = new Date();
        let startDate = new Date();

        switch(range) {
            case '3m':
                // Calculate 3 months ago
                startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
                break;
            case '6m':
                // Calculate 6 months ago
                startDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
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
                startDate.setFullYear(today.getFullYear() - 5);
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
            chartEl.style.display = 'none';

            // Try to load directly from GitHub first (faster, no server wake-up delay)
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

                // Update current month growth if we have growth data
                if (this.growthData) {
                    this.updateCurrentMonthGrowth();
                }

                // Try to load momentum chart (will succeed once we have data)
                this.loadMomentumChart();
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
            chartEl.style.display = 'none';

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

                // Update current month growth if we have growth data
                if (this.growthData) {
                    this.updateCurrentMonthGrowth();
                }

                // Reload momentum chart after each refresh
                this.loadMomentumChart();
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
     * Refresh all indicators from API
     */
    async refreshAllData() {
        for (const indicator of this.indicators) {
            await this.refreshData(indicator);
        }
        // Reload momentum and growth charts after refreshing all data
        await this.loadMomentumChart();
        await this.loadGrowthChart();
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

    /**
     * Load and plot momentum comparison chart
     */
    async loadMomentumChart() {
        const loadingEl = document.getElementById('momentum-loading');
        const errorEl = document.getElementById('momentum-error');
        const chartEl = document.getElementById('momentum-chart');
        const baselineDateEl = document.getElementById('baseline-date');

        try {
            // Show loading state
            loadingEl.style.display = 'block';
            errorEl.style.display = 'none';
            chartEl.style.display = 'none';

            // Get selected baseline period
            const period = document.getElementById('momentum-baseline').value;

            // Fetch momentum data from server with period parameter
            const response = await fetch(`${CONFIG.SERVER_URL}/api/data/momentum?period=${period}`);
            const result = await response.json();

            console.log('Momentum API response:', result);

            if (result.success && result.data) {
                // Check if we have any data
                const hasData = Object.keys(result.data).length > 0;

                console.log('Has momentum data:', hasData, 'Keys:', Object.keys(result.data));

                if (!hasData) {
                    throw new Error('No data available yet. Please wait for initial data to load or click "Refresh All Data".');
                }

                // Store raw momentum data
                this.momentumData = result.data;

                // Set baseline date from first indicator's baseline date
                let baselineDateStr = '';
                for (const indicator of this.indicators) {
                    if (this.momentumData[indicator] && this.momentumData[indicator].baselineDate) {
                        const baselineDate = new Date(this.momentumData[indicator].baselineDate);
                        baselineDateStr = baselineDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        break;
                    }
                }
                if (baselineDateStr) {
                    baselineDateEl.textContent = `Baseline: ${baselineDateStr} = 100`;
                }

                // Plot momentum chart (showing all data from baseline)
                this.plotMomentumChart();

                // Hide loading, show chart
                loadingEl.style.display = 'none';
                chartEl.style.display = 'block';
            } else {
                throw new Error('No momentum data available');
            }

        } catch (error) {
            console.error('Error loading momentum chart:', error);
            loadingEl.style.display = 'none';
            errorEl.textContent = `Error loading momentum chart: ${error.message}`;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Plot momentum chart showing all data from baseline
     */
    plotMomentumChart() {
        if (!this.momentumData) return;

        const traces = [];
        let latestDate = null;

        // Plot all data from baseline onwards
        for (const indicator of this.indicators) {
            if (this.momentumData[indicator]) {
                const dates = this.momentumData[indicator].dates;
                const values = this.momentumData[indicator].values;

                // Track latest date
                if (!latestDate || dates[dates.length - 1] > latestDate) {
                    latestDate = dates[dates.length - 1];
                }

                // Line trace
                traces.push({
                    x: dates,
                    y: values,
                    type: 'scatter',
                    mode: 'lines',
                    name: this.compactNames[indicator] || this.momentumData[indicator].name,
                    line: {
                        color: this.chartColors[indicator],
                        width: 2.5
                    },
                    hovertemplate: '<b>%{fullData.name}</b><br>' +
                                  'Date: %{x}<br>' +
                                  'Value: %{y:.2f}<br>' +
                                  '<extra></extra>',
                    legendgroup: indicator
                });

                // Most recent point marker
                traces.push({
                    x: [dates[dates.length - 1]],
                    y: [values[values.length - 1]],
                    type: 'scatter',
                    mode: 'markers',
                    name: this.compactNames[indicator] || this.momentumData[indicator].name,
                    marker: {
                        color: this.chartColors[indicator],
                        size: 8,
                        symbol: 'circle',
                        line: {
                            color: 'white',
                            width: 2
                        }
                    },
                    hovertemplate: '<b>%{fullData.name} Latest:</b> %{y:.2f}<br>' +
                                  'Date: %{x}<br>' +
                                  '<extra></extra>',
                    showlegend: false,
                    legendgroup: indicator
                });
            }
        }

        const layout = {
                    title: {
                        text: '',
                        font: { size: 18 }
                    },
                    xaxis: {
                        title: 'Date',
                        showgrid: true,
                        gridcolor: '#e0e0e0'
                    },
                    yaxis: {
                        title: 'Normalized Value (Baseline = 100)',
                        showgrid: true,
                        gridcolor: '#e0e0e0',
                        zeroline: true,
                        zerolinecolor: '#999',
                        zerolinewidth: 1
                    },
                    hovermode: 'closest',
                    plot_bgcolor: '#fafafa',
                    paper_bgcolor: 'white',
                    margin: { t: 30, r: 30, b: 60, l: 70 },
                    autosize: true,
                    legend: {
                        orientation: 'h',
                        yanchor: 'bottom',
                        y: 1.02,
                        xanchor: 'left',
                        x: 0,
                        bgcolor: 'rgba(255,255,255,0.8)',
                        bordercolor: '#ddd',
                        borderwidth: 1
                    },
                    shapes: traces.length > 0 ? [{
                        type: 'line',
                        x0: traces[0].x[0],
                        x1: traces[0].x[traces[0].x.length - 1],
                        y0: 100,
                        y1: 100,
                        line: {
                            color: 'rgba(0,0,0,0.3)',
                            width: 1,
                            dash: 'dash'
                        }
                    }] : []
                };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: 'momentum_comparison',
                height: 800,
                width: 1400,
                scale: 2
            }
        };

        Plotly.newPlot('momentum-chart', traces, layout, config);
    }

    /**
     * Load and plot month-over-month growth rate chart
     */
    async loadGrowthChart() {
        const loadingEl = document.getElementById('growth-loading');
        const errorEl = document.getElementById('growth-error');
        const chartEl = document.getElementById('growth-chart');

        try {
            // Show loading state
            loadingEl.style.display = 'block';
            errorEl.style.display = 'none';
            chartEl.style.display = 'none';

            // Fetch growth data from server
            const response = await fetch(`${CONFIG.SERVER_URL}/api/data/growth`);
            const result = await response.json();

            console.log('Growth API response:', result);

            if (result.success && result.data) {
                // Check if we have any data
                const hasData = Object.keys(result.data).length > 0;

                console.log('Has growth data:', hasData, 'Keys:', Object.keys(result.data));

                if (!hasData) {
                    throw new Error('No growth data available yet. Please wait for initial data to load or click "Refresh All Data".');
                }

                // Store raw growth data
                this.growthData = result.data;

                // Update previous month growth rates
                this.updatePreviousMonthGrowth();

                // Plot with current filter
                this.filterAndPlotGrowth();

                // Update growth table
                this.updateGrowthTable();

                // Hide loading, show chart
                loadingEl.style.display = 'none';
                chartEl.style.display = 'block';
            } else {
                throw new Error('No growth data available');
            }

        } catch (error) {
            console.error('Error loading growth chart:', error);
            loadingEl.style.display = 'none';
            errorEl.textContent = `Error loading growth chart: ${error.message}`;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Update previous month growth rates display
     */
    updatePreviousMonthGrowth() {
        const today = new Date();
        const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthName = prevMonth.toLocaleDateString('en-US', { month: 'short' });

        // Update header
        const headerElement = document.getElementById('prev-month-header');
        if (headerElement) {
            headerElement.textContent = `${prevMonthName} (%)`;
        }

        for (const indicator of this.indicators) {
            if (this.allData[indicator]) {
                const dates = this.allData[indicator].dates;
                const values = this.allData[indicator].values;

                // Find end of month 2 months ago (baseline for previous month)
                const endOfTwoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 1, 0);
                const endOfTwoMonthsAgoStr = endOfTwoMonthsAgo.toISOString().split('T')[0];

                // Find end of previous month (end point for previous month)
                const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                const endOfPrevMonthStr = endOfPrevMonth.toISOString().split('T')[0];

                // Find value at end of two months ago
                let baselineValue = null;
                for (let i = dates.length - 1; i >= 0; i--) {
                    if (dates[i] <= endOfTwoMonthsAgoStr) {
                        baselineValue = values[i];
                        break;
                    }
                }

                // Find value at end of previous month
                let endValue = null;
                for (let i = dates.length - 1; i >= 0; i--) {
                    if (dates[i] <= endOfPrevMonthStr) {
                        endValue = values[i];
                        break;
                    }
                }

                if (baselineValue && endValue) {
                    const growthRate = ((endValue - baselineValue) / baselineValue) * 100;
                    const element = document.getElementById(`prev-growth-${indicator}`);

                    if (element) {
                        element.textContent = growthRate.toFixed(2) + '%';

                        // Add color class based on positive/negative
                        element.classList.remove('positive', 'negative');
                        if (growthRate > 0) {
                            element.classList.add('positive');
                        } else if (growthRate < 0) {
                            element.classList.add('negative');
                        }
                    }
                }
            }
        }

        // Calculate and display current month-to-date growth
        this.updateCurrentMonthGrowth();
    }

    /**
     * Calculate and display current month-to-date growth
     */
    updateCurrentMonthGrowth() {
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        let latestDataDate = null;

        for (const indicator of this.indicators) {
            if (this.allData[indicator]) {
                const dates = this.allData[indicator].dates;
                const values = this.allData[indicator].values;

                // Track the latest date across all indicators
                const indicatorLatestDate = dates[dates.length - 1];
                if (!latestDataDate || indicatorLatestDate > latestDataDate) {
                    latestDataDate = indicatorLatestDate;
                }

                // Find last day of previous month
                const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                const lastDayPrevMonthStr = lastDayPrevMonth.toISOString().split('T')[0];

                // Find the closest date on or before last day of previous month
                let baselineValue = null;
                for (let i = dates.length - 1; i >= 0; i--) {
                    if (dates[i] <= lastDayPrevMonthStr) {
                        baselineValue = values[i];
                        break;
                    }
                }

                // Get the most recent value (today or closest to today)
                const currentValue = values[values.length - 1];

                if (baselineValue && currentValue) {
                    const growthRate = ((currentValue - baselineValue) / baselineValue) * 100;
                    const element = document.getElementById(`current-growth-${indicator}`);

                    if (element) {
                        element.textContent = growthRate.toFixed(2) + '%';

                        // Add color class based on positive/negative
                        element.classList.remove('positive', 'negative');
                        if (growthRate > 0) {
                            element.classList.add('positive');
                        } else if (growthRate < 0) {
                            element.classList.add('negative');
                        }
                    }
                }
            }
        }

        // Update header to show current month and as-of date with full date
        const headerElement = document.getElementById('current-month-header');
        if (headerElement && latestDataDate) {
            const asOfDate = new Date(latestDataDate);
            const monthName = today.toLocaleDateString('en-US', { month: 'short' });
            const formattedDate = asOfDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            headerElement.innerHTML = `${monthName}<br><span class="as-of-date">as of ${formattedDate}</span>`;
        }
    }

    /**
     * Filter and plot growth chart based on selected months
     */
    filterAndPlotGrowth() {
        if (!this.growthData) return;

        const monthsFilter = document.getElementById('growth-months').value;
        const traces = [];
        let latestMonth = null;

        // Filter data based on selected months
        for (const indicator of this.indicators) {
            if (this.growthData[indicator]) {
                let dates = this.growthData[indicator].dates;
                let values = this.growthData[indicator].values;

                // Apply filter if not "all"
                if (monthsFilter !== 'all') {
                    const numMonths = parseInt(monthsFilter);
                    const startIndex = Math.max(0, dates.length - numMonths);
                    dates = dates.slice(startIndex);
                    values = values.slice(startIndex);
                }

                // Track latest month
                if (!latestMonth || dates[dates.length - 1] > latestMonth) {
                    latestMonth = dates[dates.length - 1];
                }

                // Line trace with small markers
                traces.push({
                    x: dates,
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: this.compactNames[indicator] || this.growthData[indicator].name,
                    line: {
                        color: this.chartColors[indicator],
                        width: 2
                    },
                    marker: {
                        color: this.chartColors[indicator],
                        size: 4
                    },
                    hovertemplate: '<b>%{fullData.name}</b><br>' +
                                  'Month: %{x}<br>' +
                                  'Growth: %{y:.2f}%<br>' +
                                  '<extra></extra>',
                    legendgroup: indicator
                });

                // Highlighted most recent point
                traces.push({
                    x: [dates[dates.length - 1]],
                    y: [values[values.length - 1]],
                    type: 'scatter',
                    mode: 'markers',
                    name: this.compactNames[indicator] || this.growthData[indicator].name,
                    marker: {
                        color: this.chartColors[indicator],
                        size: 10,
                        symbol: 'circle',
                        line: {
                            color: 'white',
                            width: 2
                        }
                    },
                    hovertemplate: '<b>%{fullData.name} Latest:</b> %{y:.2f}%<br>' +
                                  'Month: %{x}<br>' +
                                  '<extra></extra>',
                    showlegend: false,
                    legendgroup: indicator
                });
            }
        }

        const layout = {
                    title: {
                        text: '',
                        font: { size: 18 }
                    },
                    xaxis: {
                        title: 'Month',
                        showgrid: true,
                        gridcolor: '#e0e0e0'
                    },
                    yaxis: {
                        title: 'Growth Rate (%)',
                        showgrid: true,
                        gridcolor: '#e0e0e0',
                        zeroline: true,
                        zerolinecolor: '#999',
                        zerolinewidth: 2
                    },
                    hovermode: 'closest',
                    plot_bgcolor: '#fafafa',
                    paper_bgcolor: 'white',
                    margin: { t: 30, r: 30, b: 60, l: 70 },
                    autosize: true,
                    legend: {
                        orientation: 'h',
                        yanchor: 'bottom',
                        y: 1.02,
                        xanchor: 'left',
                        x: 0,
                        bgcolor: 'rgba(255,255,255,0.8)',
                        bordercolor: '#ddd',
                        borderwidth: 1
                    },
                    shapes: traces.length > 0 ? [{
                        type: 'line',
                        x0: traces[0].x[0],
                        x1: traces[0].x[traces[0].x.length - 1],
                        y0: 0,
                        y1: 0,
                        line: {
                            color: 'rgba(0,0,0,0.5)',
                            width: 2,
                            dash: 'solid'
                        }
                    }] : []
                };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: 'growth_rate_comparison',
                height: 800,
                width: 1400,
                scale: 2
            }
        };

        Plotly.newPlot('growth-chart', traces, layout, config);
    }

    /**
     * Update growth table with last 6 months
     */
    updateGrowthTable() {
        if (!this.growthData) return;

        const tableHeader = document.getElementById('growth-table-header');
        const tableBody = document.getElementById('growth-table-body');

        // Clear existing content
        tableHeader.innerHTML = '<th>Indicator</th>';
        tableBody.innerHTML = '';

        // Get the last 6 months of data from the first indicator
        const firstIndicator = this.indicators.find(ind => this.growthData[ind]);
        if (!firstIndicator) return;

        const allDates = this.growthData[firstIndicator].dates;
        const last6Months = allDates.slice(-6);

        // Add month headers
        last6Months.forEach(dateStr => {
            const date = new Date(dateStr);
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const th = document.createElement('th');
            th.textContent = monthName;
            tableHeader.appendChild(th);
        });

        // Add rows for each indicator
        this.indicators.forEach(indicator => {
            if (this.growthData[indicator]) {
                const row = document.createElement('tr');

                // Add indicator name cell
                const nameCell = document.createElement('td');
                nameCell.textContent = this.compactNames[indicator] || indicator;
                nameCell.className = 'indicator-name-cell';
                row.appendChild(nameCell);

                // Get last 6 months of growth data
                const dates = this.growthData[indicator].dates;
                const values = this.growthData[indicator].values;
                const last6Values = values.slice(-6);

                // Add value cells
                last6Values.forEach(value => {
                    const cell = document.createElement('td');
                    cell.textContent = value.toFixed(2) + '%';

                    // Add color class based on positive/negative
                    if (value > 0) {
                        cell.classList.add('positive');
                    } else if (value < 0) {
                        cell.classList.add('negative');
                    }

                    row.appendChild(cell);
                });

                tableBody.appendChild(row);
            }
        });
    }

    /**
     * Submit user's estimate
     */
    async submitEstimate() {
        const name = document.getElementById('user-name').value.trim();

        if (!name) {
            alert('Please enter your name');
            return;
        }

        // Collect estimates
        const estimates = {};
        for (const indicator of this.indicators) {
            const value = document.getElementById(`estimate-${indicator}`).value;
            if (!value) {
                alert(`Please select an estimate for ${indicator}`);
                return;
            }
            estimates[indicator] = value;
        }

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/estimates/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, estimates })
            });

            const result = await response.json();

            if (result.success) {
                alert('Estimate submitted successfully!');
                // Clear form
                document.getElementById('user-name').value = '';
                this.indicators.forEach(indicator => {
                    document.getElementById(`estimate-${indicator}`).value = '';
                });
                // Reload estimates
                this.loadEstimates();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error submitting estimate:', error);
            alert('Error submitting estimate: ' + error.message);
        }
    }

    /**
     * Load and display all estimates
     */
    async loadEstimates() {
        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/estimates`);
            const result = await response.json();

            if (result.success) {
                this.displayEstimates(result.data);
            }
        } catch (error) {
            console.error('Error loading estimates:', error);
        }
    }

    /**
     * Display estimates in the scrollable area
     */
    displayEstimates(estimates) {
        const container = document.getElementById('submissions-container');
        container.innerHTML = '';

        // Get current growth values for comparison
        const currentGrowth = {};
        this.indicators.forEach(indicator => {
            const element = document.getElementById(`current-growth-${indicator}`);
            if (element && element.textContent !== '--') {
                currentGrowth[indicator] = parseFloat(element.textContent);
            }
        });

        // Calculate correct count for each submission
        const leaderboard = [];

        estimates.forEach(submission => {
            let correctCount = 0;

            this.indicators.forEach(indicator => {
                if (currentGrowth[indicator] !== undefined) {
                    const growth = currentGrowth[indicator];
                    const estimate = submission.estimates[indicator];
                    let isCorrect = false;

                    if (estimate === 'up' && growth > 1) {
                        isCorrect = true;
                    } else if (estimate === 'flat' && growth >= -1 && growth <= 1) {
                        isCorrect = true;
                    } else if (estimate === 'down' && growth < -1) {
                        isCorrect = true;
                    }

                    if (isCorrect) {
                        correctCount++;
                    }
                }
            });

            leaderboard.push({
                name: submission.name,
                correctCount: correctCount
            });
        });

        // Sort by correct count (descending) and get top 5
        leaderboard.sort((a, b) => b.correctCount - a.correctCount);
        const top5 = leaderboard.slice(0, 5);

        // Update leader display
        const leaderElement = document.getElementById('estimate-leader');
        if (leaderElement) {
            if (top5.length > 0 && top5[0].correctCount > 0) {
                leaderElement.innerHTML = '<h3 style="margin: 0 0 10px 0; font-size: 1.1em;">🏆 Top 5 Leaders</h3>';
                const leaderList = document.createElement('div');
                leaderList.className = 'leader-list';

                top5.forEach((entry, index) => {
                    const rank = index + 1;
                    const leaderItem = document.createElement('div');
                    leaderItem.className = `leader-item rank-${rank}`;
                    leaderItem.innerHTML = `
                        <span class="leader-rank">#${rank}</span>
                        <span class="leader-name">${entry.name}</span>
                        <span class="leader-score">${entry.correctCount}/${this.indicators.length}</span>
                    `;
                    leaderList.appendChild(leaderItem);
                });

                leaderElement.appendChild(leaderList);
                leaderElement.style.display = 'block';
            } else {
                leaderElement.style.display = 'none';
            }
        }

        estimates.forEach(submission => {
            const column = document.createElement('div');
            column.className = 'submission-column';

            // Create header with name, month, and delete button
            const headerContainer = document.createElement('div');
            headerContainer.className = 'submission-header';

            // Get submission month
            const submissionDate = new Date(submission.timestamp);
            const monthName = submissionDate.toLocaleDateString('en-US', { month: 'short' });

            const header = document.createElement('h3');
            header.innerHTML = `${submission.name}<br><span class="submission-month">${monthName}</span>`;
            header.title = `${submission.name} - ${submissionDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`; // Tooltip with full info
            header.style.borderBottom = 'none';
            header.style.paddingBottom = '0';
            headerContainer.appendChild(header);

            // Add delete button for all users
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete this submission';
            deleteBtn.onclick = () => this.deleteSubmission(submission.id, submission.name);
            headerContainer.appendChild(deleteBtn);

            column.appendChild(headerContainer);

            // Add estimates for each indicator
            this.indicators.forEach(indicator => {
                const item = document.createElement('div');
                item.className = 'submission-item';

                const estimate = submission.estimates[indicator];
                let arrow = '';
                let cssClass = '';

                if (estimate === 'up') {
                    arrow = '↑';
                    cssClass = 'up';
                } else if (estimate === 'flat') {
                    arrow = '→';
                    cssClass = 'flat';
                } else if (estimate === 'down') {
                    arrow = '↓';
                    cssClass = 'down';
                } else {
                    arrow = '--';
                }

                // Check if estimate is correct based on current growth
                if (currentGrowth[indicator] !== undefined) {
                    const growth = currentGrowth[indicator];
                    let isCorrect = false;

                    if (estimate === 'up' && growth > 1) {
                        isCorrect = true;
                    } else if (estimate === 'flat' && growth >= -1 && growth <= 1) {
                        isCorrect = true;
                    } else if (estimate === 'down' && growth < -1) {
                        isCorrect = true;
                    }

                    if (isCorrect) {
                        item.classList.add('estimate-correct');
                    }
                }

                item.innerHTML = `<span class="estimate-arrow ${cssClass}">${arrow}</span>`;
                column.appendChild(item);
            });

            // Add empty submit row for alignment
            const submitRow = document.createElement('div');
            submitRow.className = 'submission-item submit-row';
            submitRow.innerHTML = '&nbsp;';
            column.appendChild(submitRow);

            container.appendChild(column);
        });
    }

    /**
     * Admin login - now uses server-side authentication
     */
    async adminLogin() {
        const password = prompt('Enter admin password:');

        if (!password) {
            return;
        }

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (result.success) {
                this.isAdmin = true;
                this.adminToken = result.token;

                // Store token in sessionStorage
                sessionStorage.setItem('adminToken', result.token);

                document.getElementById('adminLoginBtn').style.display = 'none';
                document.getElementById('adminStatus').style.display = 'inline';

                // Show all admin-only elements
                document.querySelectorAll('.admin-only').forEach(el => {
                    if (el.tagName === 'BUTTON') {
                        el.style.display = 'inline-block';
                    } else {
                        el.style.display = '';
                    }
                });

                // Reload estimates to show delete buttons
                this.loadEstimates();

                alert('Admin mode activated');
            } else {
                alert('Incorrect password');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please check your connection.');
        }
    }

    /**
     * Admin logout
     */
    adminLogout() {
        this.isAdmin = false;
        this.adminToken = null;
        sessionStorage.removeItem('adminToken');

        document.getElementById('adminLoginBtn').style.display = '';
        document.getElementById('adminStatus').style.display = 'none';

        // Hide all admin-only elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });

        // Reload estimates to hide delete buttons
        this.loadEstimates();
    }

    /**
     * Delete a submission (public - anyone can delete)
     */
    async deleteSubmission(id, name) {
        if (!confirm(`Delete submission by ${name}?`)) {
            return;
        }

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/estimates/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                alert('Estimate deleted successfully');
                this.loadEstimates();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting submission:', error);
            alert('Error deleting submission: ' + error.message);
        }
    }

    /**
     * Load news for all indicators
     */
    async loadNews() {
        try {
            // Try to load directly from GitHub first (faster, auto-updates when GitHub Actions runs)
            let newsData;
            try {
                // Add timestamp to prevent caching
                const timestamp = new Date().getTime();
                const ghResponse = await fetch(`data/news.json?t=${timestamp}`);
                if (ghResponse.ok) {
                    newsData = await ghResponse.json();
                    console.log('News loaded directly from GitHub');
                }else {
                    throw new Error('GitHub file not found');
                }
            } catch (ghError) {
                // Fallback to server if GitHub fails
                console.log('News loading from server (GitHub failed)');
                const response = await fetch(`${CONFIG.SERVER_URL}/api/news/sp500`);
                const result = await response.json();
                if (result.success && result.data) {
                    newsData = result.data;
                }
            }

            if (newsData && newsData.articles) {
                // Display S&P 500 news under sp500 chart
                this.displayCompactNews('sp500', newsData.articles);

                // Show placeholder for other indicators
                this.displayCompactNews('treasury', []);
                this.displayCompactNews('oil', []);
                this.displayCompactNews('gold', []);
                this.displayCompactNews('dollar', []);
            }
        } catch (error) {
            console.error('Error loading news:', error);
        }
    }

    /**
     * Display compact news articles under a chart
     */
    displayCompactNews(indicator, articles) {
        const newsContainer = document.getElementById(`${indicator}-news`);

        if (!newsContainer) {
            console.warn(`News container not found for ${indicator}`);
            return;
        }

        // Clear existing content
        newsContainer.innerHTML = '';

        if (articles && articles.length > 0) {
            // Show only first 3 articles
            const articlesToShow = articles.slice(0, 3);

            articlesToShow.forEach(article => {
                const item = document.createElement('div');
                item.className = 'news-compact-item';

                // Format date without time (just show YYYY-MM-DD)
                const dateOnly = article.date ? article.date.split('T')[0] : '';

                item.innerHTML = `
                    <a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>
                    <div class="news-compact-meta">${article.source}${dateOnly ? ' • ' + dateOnly : ''}</div>
                `;
                newsContainer.appendChild(item);
            });
        } else {
            newsContainer.innerHTML = '<div class="news-compact-empty">No recent news</div>';
        }
    }

    /**
     * Collect news using OpenAI
     */
    async collectNews() {
        if (!this.isAdmin) {
            alert('Only admins can collect news');
            return;
        }

        const button = document.getElementById('collect-news-btn');
        const loadingEl = document.getElementById('news-loading');

        try {
            // Disable button and show loading
            button.disabled = true;
            loadingEl.style.display = 'block';

            const response = await fetch(`${CONFIG.SERVER_URL}/api/news/collect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });

            const result = await response.json();

            if (result.success && result.data && result.data.articles) {
                // Update S&P 500 news display
                this.displayCompactNews('sp500', result.data.articles);
                alert(result.message);
            } else {
                alert('Error: ' + result.message);
            }

        } catch (error) {
            console.error('Error collecting news:', error);
            alert('Error collecting news: ' + error.message);
        } finally {
            button.disabled = false;
            loadingEl.style.display = 'none';
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EconomicDashboard();
});