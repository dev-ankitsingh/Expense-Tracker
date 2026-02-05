// ===== Authentication Manager =====
class AuthManager {
    constructor() {
        this.currentUser = this.loadUser();
    }

    loadUser() {
        try {
            const user = localStorage.getItem('currentUser');
            return user ? JSON.parse(user) : null;
        } catch (error) {
            console.error('Error loading user:', error);
            return null;
        }
    }

    saveUser(user) {
        try {
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.currentUser = user;
        } catch (error) {
            console.error('Error saving user:', error);
        }
    }

    getUsers() {
        try {
            const users = localStorage.getItem('users');
            return users ? JSON.parse(users) : [];
        } catch (error) {
            console.error('Error loading users:', error);
            return [];
        }
    }

    saveUsers(users) {
        try {
            localStorage.setItem('users', JSON.stringify(users));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    signup(name, email, password) {
        const users = this.getUsers();
        
        // Check if user already exists
        if (users.find(u => u.email === email)) {
            throw new Error('User with this email already exists');
        }

        const newUser = {
            id: Date.now(),
            name,
            email,
            password, // In production, this should be hashed
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        this.saveUsers(users);
        
        // Auto login after signup
        const userWithoutPassword = { ...newUser };
        delete userWithoutPassword.password;
        this.saveUser(userWithoutPassword);
        
        return userWithoutPassword;
    }

    login(email, password) {
        const users = this.getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            throw new Error('Invalid email or password');
        }

        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;
        this.saveUser(userWithoutPassword);
        
        return userWithoutPassword;
    }

    logout() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }
}

// ===== Data Management =====
class DataManager {
    constructor(userId) {
        this.userId = userId;
        this.funds = this.loadData('funds') || [];
        this.expenses = this.loadData('expenses') || [];
        this.budget = this.loadData('budget') || 1000;
    }

    getStorageKey(key) {
        return `${this.userId}_${key}`;
    }

    loadData(key) {
        try {
            const data = localStorage.getItem(this.getStorageKey(key));
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Error loading ${key}:`, error);
            return null;
        }
    }

    saveData(key, data) {
        try {
            localStorage.setItem(this.getStorageKey(key), JSON.stringify(data));
        } catch (error) {
            console.error(`Error saving ${key}:`, error);
        }
    }

    addFund(fund) {
        this.funds.push(fund);
        this.saveData('funds', this.funds);
    }

    addExpense(expense) {
        this.expenses.push(expense);
        this.saveData('expenses', this.expenses);
    }

    updateTransaction(id, type, data) {
        if (type === 'fund') {
            const index = this.funds.findIndex(f => f.id === id);
            if (index !== -1) {
                this.funds[index] = { ...this.funds[index], ...data };
                this.saveData('funds', this.funds);
            }
        } else {
            const index = this.expenses.findIndex(e => e.id === id);
            if (index !== -1) {
                this.expenses[index] = { ...this.expenses[index], ...data };
                this.saveData('expenses', this.expenses);
            }
        }
    }

    deleteTransaction(id, type) {
        if (type === 'fund') {
            this.funds = this.funds.filter(f => f.id !== id);
            this.saveData('funds', this.funds);
        } else {
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.saveData('expenses', this.expenses);
        }
    }

    getTotalFunds() {
        return this.funds.reduce((sum, fund) => sum + parseFloat(fund.amount), 0);
    }

    getTotalExpenses() {
        return this.expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    }

    getBalance() {
        return this.getTotalFunds() - this.getTotalExpenses();
    }

    getTodayExpenses() {
        const today = new Date().toDateString();
        return this.expenses
            .filter(e => new Date(e.date).toDateString() === today)
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    }

    getMonthlyExpenses() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        return this.expenses
            .filter(e => {
                const date = new Date(e.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    }

    getCategoryBreakdown() {
        const breakdown = {};
        this.expenses.forEach(expense => {
            const category = expense.category;
            breakdown[category] = (breakdown[category] || 0) + parseFloat(expense.amount);
        });
        return breakdown;
    }

    getMonthlyTrend() {
        const trend = {};
        const now = new Date();
        
        // Get last 6 months
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            trend[key] = 0;
        }

        this.expenses.forEach(expense => {
            const date = new Date(expense.date);
            const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            if (trend.hasOwnProperty(key)) {
                trend[key] += parseFloat(expense.amount);
            }
        });

        return trend;
    }
}

// ===== UI Manager =====
class UIManager {
    constructor(dataManager, authManager) {
        this.dataManager = dataManager;
        this.authManager = authManager;
        this.currentTab = 'all';
        this.currentPeriod = 'all';
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.customFromDate = null;
        this.customToDate = null;
        this.deleteId = null;
        this.deleteType = null;
        this.charts = {};
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeCharts();
        this.updateUI();
        this.setDefaultDates();
        this.displayUserName();
    }

    initializeElements() {
        // Stats
        this.totalBalanceEl = document.getElementById('totalBalance');
        this.todayExpensesEl = document.getElementById('todayExpenses');
        this.monthlyExpensesEl = document.getElementById('monthlyExpenses');
        this.totalFundsEl = document.getElementById('totalFunds');
        
        // Lists
        this.transactionsListEl = document.getElementById('transactionsList');
        this.emptyStateEl = document.getElementById('emptyState');
        
        // Modals
        this.addFundsModal = document.getElementById('addFundsModal');
        this.addExpenseModal = document.getElementById('addExpenseModal');
        this.editModal = document.getElementById('editModal');
        this.deleteModal = document.getElementById('deleteModal');
        this.exportModal = document.getElementById('exportModal');
        
        // Forms
        this.addFundsForm = document.getElementById('addFundsForm');
        this.addExpenseForm = document.getElementById('addExpenseForm');
        this.editForm = document.getElementById('editForm');
        
        // Filters
        this.periodFilter = document.getElementById('periodFilter');
        this.categoryFilter = document.getElementById('categoryFilter');
        this.searchInput = document.getElementById('searchInput');
        this.customDateGroup = document.getElementById('customDateGroup');
        this.customDateGroupTo = document.getElementById('customDateGroupTo');
        this.fromDateInput = document.getElementById('fromDate');
        this.toDateInput = document.getElementById('toDate');
        
        // Toast
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
        
        // Budget Alert
        this.budgetAlert = document.getElementById('budgetAlert');
    }

    attachEventListeners() {
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        
        // Add Funds
        document.getElementById('addFundsBtn').addEventListener('click', () => this.openModal('addFundsModal'));
        document.getElementById('fabAddFunds').addEventListener('click', () => {
            this.openModal('addFundsModal');
            this.toggleFabMenu();
        });
        this.addFundsForm.addEventListener('submit', (e) => this.handleAddFunds(e));
        
        // Add Expense
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.openModal('addExpenseModal'));
        document.getElementById('fabAddExpense').addEventListener('click', () => {
            this.openModal('addExpenseModal');
            this.toggleFabMenu();
        });
        document.getElementById('emptyAddBtn').addEventListener('click', () => this.openModal('addExpenseModal'));
        this.addExpenseForm.addEventListener('submit', (e) => this.handleAddExpense(e));
        
        // Edit
        this.editForm.addEventListener('submit', (e) => this.handleEdit(e));
        
        // Delete
        document.getElementById('confirmDelete').addEventListener('click', () => this.handleDelete());
        
        // Modal Close
        document.querySelectorAll('.modal-close, .modal-overlay, [data-modal]').forEach(el => {
            el.addEventListener('click', (e) => {
                const modalId = e.target.dataset.modal || e.target.closest('[data-modal]')?.dataset.modal;
                if (modalId) {
                    this.closeModal(modalId);
                } else if (e.target.classList.contains('modal-overlay')) {
                    this.closeAllModals();
                }
            });
        });
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTabChange(e));
        });
        
        // Filters
        this.periodFilter.addEventListener('change', () => this.handlePeriodChange());
        this.categoryFilter.addEventListener('change', () => this.handleFilterChange());
        this.searchInput.addEventListener('input', () => this.handleFilterChange());
        this.fromDateInput.addEventListener('change', () => this.handleCustomDateChange());
        this.toDateInput.addEventListener('change', () => this.handleCustomDateChange());
        
        // FAB
        document.getElementById('fab').addEventListener('click', () => this.toggleFabMenu());
        
        // Export
        document.getElementById('exportBtn').addEventListener('click', () => this.openModal('exportModal'));
        document.getElementById('exportCSV').addEventListener('click', () => this.exportToCSV());
        document.getElementById('exportPDF').addEventListener('click', () => this.exportToPDF());
        
        // Budget Alert Close
        document.getElementById('closeBudgetAlert').addEventListener('click', () => {
            this.budgetAlert.style.display = 'none';
        });
    }

    displayUserName() {
        const userName = document.getElementById('userName');
        if (this.authManager.currentUser) {
            userName.textContent = this.authManager.currentUser.name;
        }
    }

    handleLogout() {
        this.authManager.logout();
        window.location.reload();
    }

    handlePeriodChange() {
        this.currentPeriod = this.periodFilter.value;
        
        if (this.currentPeriod === 'custom') {
            this.customDateGroup.style.display = 'flex';
            this.customDateGroupTo.style.display = 'flex';
        } else {
            this.customDateGroup.style.display = 'none';
            this.customDateGroupTo.style.display = 'none';
            this.customFromDate = null;
            this.customToDate = null;
        }
        
        this.renderTransactions();
    }

    handleCustomDateChange() {
        this.customFromDate = this.fromDateInput.value;
        this.customToDate = this.toDateInput.value;
        this.renderTransactions();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fundsDate').value = today;
        document.getElementById('expenseDate').value = today;
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    showToast(message) {
        this.toastMessage.textContent = message;
        this.toast.classList.add('show');
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }

    toggleFabMenu() {
        const fab = document.getElementById('fab');
        const fabMenu = document.getElementById('fabMenu');
        fab.classList.toggle('active');
        fabMenu.classList.toggle('active');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'short',
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        });
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    handleAddFunds(e) {
        e.preventDefault();
        const fund = {
            id: Date.now(),
            amount: parseFloat(document.getElementById('fundsAmount').value),
            source: document.getElementById('fundsSource').value,
            date: document.getElementById('fundsDate').value,
            createdAt: new Date().toISOString()
        };
        
        this.dataManager.addFund(fund);
        this.updateUI();
        this.closeModal('addFundsModal');
        this.addFundsForm.reset();
        this.setDefaultDates();
        this.showToast('Funds added successfully!');
    }

    handleAddExpense(e) {
        e.preventDefault();
        const expense = {
            id: Date.now(),
            amount: parseFloat(document.getElementById('expenseAmount').value),
            category: document.getElementById('expenseCategory').value,
            note: document.getElementById('expenseNote').value,
            date: document.getElementById('expenseDate').value,
            createdAt: new Date().toISOString()
        };
        
        this.dataManager.addExpense(expense);
        this.updateUI();
        this.closeModal('addExpenseModal');
        this.addExpenseForm.reset();
        this.setDefaultDates();
        this.showToast('Expense added successfully!');
    }

    openEditModal(id, type) {
        const transaction = type === 'fund' 
            ? this.dataManager.funds.find(f => f.id === id)
            : this.dataManager.expenses.find(e => e.id === id);
        
        if (!transaction) return;
        
        document.getElementById('editId').value = id;
        document.getElementById('editType').value = type;
        document.getElementById('editAmount').value = transaction.amount;
        document.getElementById('editDate').value = transaction.date;
        
        const editModalTitle = document.getElementById('editModalTitle');
        const editSourceGroup = document.getElementById('editSourceGroup');
        const editCategoryGroup = document.getElementById('editCategoryGroup');
        const editNoteGroup = document.getElementById('editNoteGroup');
        
        if (type === 'fund') {
            editModalTitle.textContent = '💵 Edit Fund';
            document.getElementById('editSource').value = transaction.source;
            editSourceGroup.style.display = 'flex';
            editCategoryGroup.style.display = 'none';
            editNoteGroup.style.display = 'none';
        } else {
            editModalTitle.textContent = '💸 Edit Expense';
            document.getElementById('editCategory').value = transaction.category;
            document.getElementById('editNote').value = transaction.note;
            editSourceGroup.style.display = 'none';
            editCategoryGroup.style.display = 'flex';
            editNoteGroup.style.display = 'flex';
        }
        
        this.openModal('editModal');
    }

    handleEdit(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('editId').value);
        const type = document.getElementById('editType').value;
        const amount = parseFloat(document.getElementById('editAmount').value);
        const date = document.getElementById('editDate').value;
        
        const data = { amount, date };
        
        if (type === 'fund') {
            data.source = document.getElementById('editSource').value;
        } else {
            data.category = document.getElementById('editCategory').value;
            data.note = document.getElementById('editNote').value;
        }
        
        this.dataManager.updateTransaction(id, type, data);
        this.updateUI();
        this.closeModal('editModal');
        this.showToast('Transaction updated successfully!');
    }

    openDeleteModal(id, type) {
        this.deleteId = id;
        this.deleteType = type;
        this.openModal('deleteModal');
    }

    handleDelete() {
        if (this.deleteId && this.deleteType) {
            this.dataManager.deleteTransaction(this.deleteId, this.deleteType);
            this.updateUI();
            this.closeModal('deleteModal');
            this.showToast('Transaction deleted successfully!');
            this.deleteId = null;
            this.deleteType = null;
        }
    }

    handleTabChange(e) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTab = e.target.dataset.tab;
        this.renderTransactions();
    }

    handleFilterChange() {
        this.currentCategory = this.categoryFilter.value;
        this.searchQuery = this.searchInput.value.toLowerCase();
        this.renderTransactions();
    }

    updateUI() {
        this.updateStats();
        this.renderTransactions();
        this.updateCharts();
        this.checkBudgetAlert();
    }

    updateStats() {
        const balance = this.dataManager.getBalance();
        const todayExpenses = this.dataManager.getTodayExpenses();
        const monthlyExpenses = this.dataManager.getMonthlyExpenses();
        const totalFunds = this.dataManager.getTotalFunds();
        
        this.totalBalanceEl.textContent = `$${balance.toFixed(2)}`;
        this.todayExpensesEl.textContent = `$${todayExpenses.toFixed(2)}`;
        this.monthlyExpensesEl.textContent = `$${monthlyExpenses.toFixed(2)}`;
        this.totalFundsEl.textContent = `$${totalFunds.toFixed(2)}`;
    }

    filterTransactions() {
        let transactions = [];
        
        // Get transactions based on tab
        if (this.currentTab === 'all') {
            const funds = this.dataManager.funds.map(f => ({ ...f, type: 'fund' }));
            const expenses = this.dataManager.expenses.map(e => ({ ...e, type: 'expense' }));
            transactions = [...funds, ...expenses];
        } else if (this.currentTab === 'funds') {
            transactions = this.dataManager.funds.map(f => ({ ...f, type: 'fund' }));
        } else {
            transactions = this.dataManager.expenses.map(e => ({ ...e, type: 'expense' }));
        }
        
        // Filter by period
        if (this.currentPeriod !== 'all') {
            const now = new Date();
            transactions = transactions.filter(t => {
                const date = new Date(t.date);
                
                if (this.currentPeriod === 'today') {
                    return date.toDateString() === now.toDateString();
                } else if (this.currentPeriod === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return date >= weekAgo;
                } else if (this.currentPeriod === 'month') {
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                } else if (this.currentPeriod === 'custom') {
                    if (this.customFromDate && this.customToDate) {
                        const fromDate = new Date(this.customFromDate);
                        const toDate = new Date(this.customToDate);
                        toDate.setHours(23, 59, 59, 999); // Include the entire end date
                        return date >= fromDate && date <= toDate;
                    } else if (this.customFromDate) {
                        const fromDate = new Date(this.customFromDate);
                        return date >= fromDate;
                    } else if (this.customToDate) {
                        const toDate = new Date(this.customToDate);
                        toDate.setHours(23, 59, 59, 999);
                        return date <= toDate;
                    }
                }
                return true;
            });
        }
        
        // Filter by category
        if (this.currentCategory !== 'all') {
            transactions = transactions.filter(t => t.category === this.currentCategory);
        }
        
        // Filter by search
        if (this.searchQuery) {
            transactions = transactions.filter(t => {
                const searchText = `${t.source || ''} ${t.category || ''} ${t.note || ''} ${t.amount}`.toLowerCase();
                return searchText.includes(this.searchQuery);
            });
        }
        
        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return transactions;
    }

    renderTransactions() {
        const transactions = this.filterTransactions();
        
        if (transactions.length === 0) {
            this.emptyStateEl.style.display = 'block';
            this.transactionsListEl.innerHTML = '';
            this.transactionsListEl.appendChild(this.emptyStateEl);
            return;
        }
        
        this.emptyStateEl.style.display = 'none';
        this.transactionsListEl.innerHTML = transactions.map(t => this.createTransactionHTML(t)).join('');
        
        // Attach event listeners to action buttons
        this.transactionsListEl.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.closest('.action-btn').dataset.id);
                const type = e.target.closest('.action-btn').dataset.type;
                this.openEditModal(id, type);
            });
        });
        
        this.transactionsListEl.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.closest('.action-btn').dataset.id);
                const type = e.target.closest('.action-btn').dataset.type;
                this.openDeleteModal(id, type);
            });
        });
    }

    createTransactionHTML(transaction) {
        const isFund = transaction.type === 'fund';
        const icon = isFund ? '💵' : this.getCategoryIcon(transaction.category);
        const title = isFund ? transaction.source : (transaction.note || transaction.category);
        const date = this.formatDate(transaction.date);
        const category = isFund ? 'Fund' : transaction.category;
        const amount = isFund ? `+$${transaction.amount.toFixed(2)}` : `-$${transaction.amount.toFixed(2)}`;
        const amountClass = isFund ? 'positive' : 'negative';
        
        return `
            <div class="transaction-item">
                <div class="transaction-icon ${transaction.type}">
                    ${icon}
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">${title}</div>
                    <div class="transaction-meta">${category} • ${date}</div>
                </div>
                <div class="transaction-amount ${amountClass}">${amount}</div>
                <div class="transaction-actions">
                    <button class="action-btn edit" data-id="${transaction.id}" data-type="${transaction.type}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-btn delete" data-id="${transaction.id}" data-type="${transaction.type}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    getCategoryIcon(category) {
        const icons = {
            'Food': '🍔',
            'Travel': '✈️',
            'Shopping': '🛍️',
            'Bills': '📄',
            'Other': '📦'
        };
        return icons[category] || '📦';
    }

    initializeCharts() {
        // Monthly Chart
        const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
        this.charts.monthly = new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Monthly Spending',
                    data: [],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#a0a0b8',
                            callback: function(value) {
                                return '$' + value;
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#a0a0b8'
                        }
                    }
                }
            }
        });
        
        // Category Chart
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        this.charts.category = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#00d4ff',
                        '#9d4edd',
                        '#00ff88',
                        '#ffaa00',
                        '#ff3366'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#a0a0b8',
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    updateCharts() {
        // Update Monthly Chart
        const monthlyTrend = this.dataManager.getMonthlyTrend();
        this.charts.monthly.data.labels = Object.keys(monthlyTrend);
        this.charts.monthly.data.datasets[0].data = Object.values(monthlyTrend);
        this.charts.monthly.update();
        
        // Update Category Chart
        const categoryBreakdown = this.dataManager.getCategoryBreakdown();
        this.charts.category.data.labels = Object.keys(categoryBreakdown).map(cat => this.getCategoryIcon(cat) + ' ' + cat);
        this.charts.category.data.datasets[0].data = Object.values(categoryBreakdown);
        this.charts.category.update();
    }

    checkBudgetAlert() {
        const monthlyExpenses = this.dataManager.getMonthlyExpenses();
        const budget = this.dataManager.budget;
        
        if (monthlyExpenses >= budget * 0.8) {
            this.budgetAlert.style.display = 'flex';
        }
    }

    exportToCSV() {
        const funds = this.dataManager.funds.map(f => ({
            Type: 'Fund',
            Date: this.formatDate(f.date),
            'Full Date': f.date,
            Amount: f.amount.toFixed(2),
            Source: f.source,
            Category: '',
            Note: '',
            'Created At': this.formatDateTime(f.createdAt || f.date)
        }));
        
        const expenses = this.dataManager.expenses.map(e => ({
            Type: 'Expense',
            Date: this.formatDate(e.date),
            'Full Date': e.date,
            Amount: e.amount.toFixed(2),
            Source: '',
            Category: e.category,
            Note: e.note || '',
            'Created At': this.formatDateTime(e.createdAt || e.date)
        }));
        
        const allTransactions = [...funds, ...expenses].sort((a, b) => 
            new Date(b['Full Date']) - new Date(a['Full Date'])
        );
        
        const headers = ['Type', 'Date', 'Full Date', 'Amount', 'Source', 'Category', 'Note', 'Created At'];
        const csvContent = [
            headers.join(','),
            ...allTransactions.map(t => 
                headers.map(h => `"${t[h] || ''}"`).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expense-tracker-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.closeModal('exportModal');
        this.showToast('Exported to CSV successfully!');
    }

    exportToPDF() {
        const funds = this.dataManager.funds.map(f => ({
            ...f,
            type: 'fund',
            displayDate: this.formatDate(f.date),
            displayCreated: this.formatDateTime(f.createdAt || f.date)
        }));
        
        const expenses = this.dataManager.expenses.map(e => ({
            ...e,
            type: 'expense',
            displayDate: this.formatDate(e.date),
            displayCreated: this.formatDateTime(e.createdAt || e.date)
        }));
        
        const allTransactions = [...funds, ...expenses].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        const balance = this.dataManager.getBalance();
        const totalFunds = this.dataManager.getTotalFunds();
        const totalExpenses = this.dataManager.getTotalExpenses();
        const monthlyExpenses = this.dataManager.getMonthlyExpenses();

        // Create PDF content
        let pdfContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Expense Tracker Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #00d4ff;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #00d4ff;
            margin: 0;
        }
        .header p {
            color: #666;
            margin: 5px 0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            background: #f9f9f9;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #555;
            font-size: 14px;
        }
        .summary-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #00d4ff;
        }
        .summary-card.balance .value {
            color: #9d4edd;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background: #00d4ff;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #e0e0e0;
        }
        tr:hover {
            background: #f5f5f5;
        }
        .fund {
            color: #00ff88;
            font-weight: 600;
        }
        .expense {
            color: #ff3366;
            font-weight: 600;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #999;
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>💰 Expense Tracker Report</h1>
        <p>Generated on ${this.formatDateTime(new Date().toISOString())}</p>
    </div>

    <div class="summary">
        <div class="summary-card balance">
            <h3>Total Balance</h3>
            <div class="value">$${balance.toFixed(2)}</div>
        </div>
        <div class="summary-card">
            <h3>Total Funds</h3>
            <div class="value">$${totalFunds.toFixed(2)}</div>
        </div>
        <div class="summary-card">
            <h3>Total Expenses</h3>
            <div class="value">$${totalExpenses.toFixed(2)}</div>
        </div>
        <div class="summary-card">
            <h3>This Month's Expenses</h3>
            <div class="value">$${monthlyExpenses.toFixed(2)}</div>
        </div>
    </div>

    <h2>Transaction History</h2>
    <table>
        <thead>
            <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Created At</th>
            </tr>
        </thead>
        <tbody>
`;

        allTransactions.forEach(t => {
            const isFund = t.type === 'fund';
            const description = isFund ? t.source : (t.note || '-');
            const category = isFund ? '-' : t.category;
            const amount = isFund ? `+$${t.amount.toFixed(2)}` : `-$${t.amount.toFixed(2)}`;
            const amountClass = isFund ? 'fund' : 'expense';
            
            pdfContent += `
            <tr>
                <td>${isFund ? '💵 Fund' : '💸 Expense'}</td>
                <td>${t.displayDate}</td>
                <td>${description}</td>
                <td>${category}</td>
                <td class="${amountClass}">${amount}</td>
                <td>${t.displayCreated}</td>
            </tr>
`;
        });

        pdfContent += `
        </tbody>
    </table>

    <div class="footer">
        <p>Daily Expense Tracker • Total Transactions: ${allTransactions.length}</p>
    </div>
</body>
</html>
`;

        // Create a new window and print
        const printWindow = window.open('', '', 'height=800,width=1000');
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
        // Wait for content to load then print
        printWindow.onload = function() {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };

        this.closeModal('exportModal');
        this.showToast('PDF export opened in new window. Use browser print to save as PDF.');
    }
}

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    
    // Check if user is logged in
    if (!authManager.isLoggedIn()) {
        // Show auth screen
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        
        // Setup auth forms
        const loginForm = document.getElementById('loginFormElement');
        const signupForm = document.getElementById('signupFormElement');
        const showSignupBtn = document.getElementById('showSignup');
        const showLoginBtn = document.getElementById('showLogin');
        
        showSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('signupForm').style.display = 'block';
        });
        
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signupForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
        });
        
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                authManager.login(email, password);
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
        
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            
            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }
            
            try {
                authManager.signup(name, email, password);
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
    } else {
        // Show main app
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        // Initialize app with user data
        const dataManager = new DataManager(authManager.currentUser.id);
        const uiManager = new UIManager(dataManager, authManager);
        
        // Make available globally for debugging
        window.app = { dataManager, uiManager, authManager };
    }
});