// Admin Dashboard Logic

class AdminDashboard {
    constructor() {
        this.adminToken = null;
        this.init();
    }

    init() {
        // Check if already logged in (session storage)
        const storedToken = sessionStorage.getItem('adminToken');
        if (storedToken) {
            this.adminToken = storedToken;
            this.showAdminContent();
        }

        // Login button
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Refresh all data
        document.getElementById('refresh-all-btn').addEventListener('click', () => this.refreshAllData());

        // Individual refresh buttons
        document.querySelectorAll('.refresh-individual-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indicator = e.target.getAttribute('data-indicator');
                this.refreshIndicator(indicator);
            });
        });

        // News collection
        document.getElementById('collect-news-btn').addEventListener('click', () => this.collectNews());

        // View estimates
        document.getElementById('view-estimates-btn').addEventListener('click', () => this.loadEstimates());
    }

    async login() {
        const password = document.getElementById('admin-password').value;
        const errorEl = document.getElementById('login-error');

        if (!password) {
            errorEl.textContent = 'Please enter a password';
            errorEl.style.display = 'block';
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
                this.adminToken = result.token;
                sessionStorage.setItem('adminToken', result.token);
                this.showAdminContent();
            } else {
                errorEl.textContent = 'Invalid password';
                errorEl.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorEl.textContent = 'Login failed. Please check your connection.';
            errorEl.style.display = 'block';
        }
    }

    logout() {
        this.adminToken = null;
        sessionStorage.removeItem('adminToken');
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('admin-content').style.display = 'none';
        document.getElementById('admin-password').value = '';
    }

    showAdminContent() {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
    }

    async refreshAllData() {
        const statusEl = document.getElementById('refresh-status');
        const btn = document.getElementById('refresh-all-btn');

        btn.disabled = true;
        statusEl.style.display = 'block';
        statusEl.style.background = '#E3F2FD';
        statusEl.style.color = '#1976D2';
        statusEl.textContent = 'Refreshing all indicators...';

        const indicators = ['sp500', 'treasury', 'oil', 'gold', 'dollar'];
        let successCount = 0;
        let failCount = 0;

        for (const indicator of indicators) {
            try {
                const response = await fetch(`${CONFIG.SERVER_URL}/api/data/${indicator}/refresh`, {
                    method: 'POST'
                });
                const result = await response.json();

                if (result.success) {
                    successCount++;
                    statusEl.textContent = `Refreshed ${successCount}/${indicators.length} indicators...`;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Error refreshing ${indicator}:`, error);
                failCount++;
            }
        }

        btn.disabled = false;

        if (failCount === 0) {
            statusEl.style.background = '#E8F5E9';
            statusEl.style.color = '#2E7D32';
            statusEl.textContent = `✓ Successfully refreshed all ${successCount} indicators!`;
        } else {
            statusEl.style.background = '#FFF3E0';
            statusEl.style.color = '#F57C00';
            statusEl.textContent = `Refreshed ${successCount} indicators. ${failCount} failed.`;
        }
    }

    async refreshIndicator(indicator) {
        const statusEl = document.getElementById('refresh-status');
        const btn = event.target;

        btn.disabled = true;
        statusEl.style.display = 'block';
        statusEl.style.background = '#E3F2FD';
        statusEl.style.color = '#1976D2';
        statusEl.textContent = `Refreshing ${indicator}...`;

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/data/${indicator}/refresh`, {
                method: 'POST'
            });
            const result = await response.json();

            btn.disabled = false;

            if (result.success) {
                statusEl.style.background = '#E8F5E9';
                statusEl.style.color = '#2E7D32';
                statusEl.textContent = `✓ Successfully refreshed ${indicator}!`;
            } else {
                statusEl.style.background = '#FFEBEE';
                statusEl.style.color = '#C62828';
                statusEl.textContent = `✗ Failed to refresh ${indicator}: ${result.message}`;
            }
        } catch (error) {
            console.error(`Error refreshing ${indicator}:`, error);
            btn.disabled = false;
            statusEl.style.background = '#FFEBEE';
            statusEl.style.color = '#C62828';
            statusEl.textContent = `✗ Error refreshing ${indicator}: ${error.message}`;
        }
    }

    async collectNews() {
        const statusEl = document.getElementById('news-status');
        const btn = document.getElementById('collect-news-btn');

        btn.disabled = true;
        statusEl.style.display = 'block';
        statusEl.style.background = '#E3F2FD';
        statusEl.style.color = '#1976D2';
        statusEl.textContent = 'Collecting news articles...';

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/news/collect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });

            const result = await response.json();

            btn.disabled = false;

            if (result.success) {
                statusEl.style.background = '#E8F5E9';
                statusEl.style.color = '#2E7D32';
                statusEl.textContent = `✓ ${result.message}`;
            } else {
                statusEl.style.background = '#FFEBEE';
                statusEl.style.color = '#C62828';
                statusEl.textContent = `✗ ${result.message}`;
            }
        } catch (error) {
            console.error('Error collecting news:', error);
            btn.disabled = false;
            statusEl.style.background = '#FFEBEE';
            statusEl.style.color = '#C62828';
            statusEl.textContent = `✗ Error: ${error.message}`;
        }
    }

    async loadEstimates() {
        const container = document.getElementById('estimates-container');
        const list = document.getElementById('estimates-list');

        container.style.display = 'block';
        list.innerHTML = '<p>Loading...</p>';

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/estimates`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                list.innerHTML = '';
                result.data.forEach(estimate => {
                    const div = document.createElement('div');
                    div.className = 'estimate-item';
                    div.innerHTML = `
                        <button class="delete-estimate-btn" onclick="admin.deleteEstimate(${estimate.id}, '${estimate.name}')">Delete</button>
                        <strong>${estimate.name}</strong> - ${new Date(estimate.timestamp).toLocaleString()}
                        <div style="margin-top: 10px;">
                            ${Object.entries(estimate.estimates).map(([key, value]) =>
                                `<div>${key}: ${value}%</div>`
                            ).join('')}
                        </div>
                    `;
                    list.appendChild(div);
                });
            } else {
                list.innerHTML = '<p>No estimates submitted yet.</p>';
            }
        } catch (error) {
            console.error('Error loading estimates:', error);
            list.innerHTML = '<p style="color: red;">Error loading estimates</p>';
        }
    }

    async deleteEstimate(id, name) {
        if (!confirm(`Delete submission by ${name}?`)) {
            return;
        }

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/estimates/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });

            const result = await response.json();

            if (result.success) {
                alert('Estimate deleted successfully');
                this.loadEstimates(); // Reload the list
            } else {
                alert('Error deleting estimate: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting estimate:', error);
            alert('Error deleting estimate: ' + error.message);
        }
    }
}

// Initialize admin dashboard
const admin = new AdminDashboard();
