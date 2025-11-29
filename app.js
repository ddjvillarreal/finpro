// Configuración de la aplicación
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbwJt5Y7Ni7p77GuFT4Q56XqsF0Yq0Qn17ty1Z9YyknP-3MtiAErRS34qBv7Fy7_YaP6/exec',
    APP_NAME: 'FinPro Admin',
    VERSION: '1.0.0'
};

// Estado global de la aplicación
let AppState = {
    user: null,
    token: null,
    dashboardData: null,
    accounts: [],
    transactions: [],
    categories: [],
    users: [],
    currentView: 'dashboard',
    loading: false
};

// Utilidades
const Utils = {
    formatMoney(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    showNotification(message, type = 'info') {
        // Remover notificaciones existentes
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icons[type] || icons.info}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">×</button>
            </div>
        `;

        // Estilos para la notificación
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6',
            color: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
            zIndex: '10000',
            maxWidth: '400px',
            minWidth: '300px',
            borderLeft: `4px solid ${type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : type === 'warning' ? '#d97706' : '#2563eb'}`
        });

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => notification.remove());

        document.body.appendChild(notification);
        
        // Auto-remover después de 6 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 6000);
    },

    setLoading(loading) {
        const loadingEl = document.getElementById('loading');
        if (loading) {
            loadingEl.classList.remove('hidden');
        } else {
            loadingEl.classList.add('hidden');
        }
        AppState.loading = loading;
    },

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};

// Servicio de API
const ApiService = {
    async request(action, data = {}) {
        try {
            console.log(`📡 Enviando solicitud: ${action}`, data);
            
            // Verificar conexión a internet
            if (!navigator.onLine) {
                throw new Error('🔌 No hay conexión a internet. Verifica tu conexión.');
            }
            
            const requestData = {
                action: action,
                data: data
            };

            // Solo agregar token si existe y no es login
            if (AppState.token && action !== 'admin-login') {
                requestData.data.token = AppState.token;
            }
            
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Error en el servidor');
            }

            return result.data;
            
        } catch (error) {
            console.error('❌ Error en API:', error);
            
            let userMessage = error.message;
            if (error.message.includes('Failed to fetch')) {
                userMessage = 'Error de conexión. Verifica tu conexión a internet y que la URL de la API sea correcta.';
            }

            Utils.showNotification(userMessage, 'error');
            throw error;
        }
    },

    // Función para probar conexión
    async testConnection() {
        try {
            const result = await this.request('test-connection', {});
            return '✅ Conexión exitosa: ' + (result.message || 'API funcionando');
        } catch (error) {
            return '❌ Error de conexión: ' + error.message;
        }
    },

    // Autenticación Admin
    async adminLogin(email, password) {
        if (!email || !password) {
            throw new Error('Email y contraseña son requeridos');
        }
        
        return this.request('admin-login', { email, password });
    },

    async changeAdminPassword(currentPassword, newPassword) {
        if (!currentPassword || !newPassword) {
            throw new Error('Ambas contraseñas son requeridas');
        }
        
        return this.request('change-admin-password', { currentPassword, newPassword });
    },

    // Gestión de Usuarios
    async createUser(userData) {
        if (!userData.email || !userData.password || !userData.name) {
            throw new Error('Todos los campos son requeridos');
        }
        
        return this.request('create-user', userData);
    },

    async getUsers() {
        return this.request('get-users');
    },

    async updateUser(userId, updates) {
        return this.request('update-user', { userId, ...updates });
    },

    // Datos Financieros
    async getDashboard() {
        return this.request('get-dashboard');
    },

    async saveTransaction(transaction) {
        if (!transaction.type || !transaction.accountId || !transaction.amount) {
            throw new Error('Tipo, cuenta y monto son requeridos');
        }
        
        return this.request('save-transaction', transaction);
    },

    async getTransactions() {
        return this.request('get-transactions');
    },

    async saveAccount(account) {
        if (!account.name || !account.currency || !account.type) {
            throw new Error('Nombre, moneda y tipo son requeridos');
        }
        
        return this.request('save-account', account);
    },

    async getAccounts() {
        return this.request('get-accounts');
    },

    async getCategories() {
        return this.request('get-categories');
    }
};

// Gestión de Autenticación
const AuthManager = {
    checkAuth() {
        const token = localStorage.getItem('finpro_admin_token');
        const user = localStorage.getItem('finpro_admin_user');
        
        if (token && user) {
            try {
                AppState.token = token;
                AppState.user = JSON.parse(user);
                return true;
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                this.logout();
                return false;
            }
        }
        return false;
    },

    async adminLogin(email, password) {
        try {
            Utils.setLoading(true);
            const result = await ApiService.adminLogin(email, password);
            
            AppState.user = result.user;
            AppState.token = result.token;
            
            localStorage.setItem('finpro_admin_token', result.token);
            localStorage.setItem('finpro_admin_user', JSON.stringify(result.user));
            
            Utils.showNotification(`✅ Bienvenido ${result.user.name}`, 'success');
            
            if (result.requiresPasswordChange) {
                this.showChangePasswordModal();
            } else {
                this.showMainApp();
            }
            
            return true;
        } catch (error) {
            console.error('Error en login:', error);
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    async changePassword(currentPassword, newPassword, confirmPassword) {
        try {
            if (newPassword !== confirmPassword) {
                throw new Error('Las contraseñas no coinciden');
            }
            
            Utils.setLoading(true);
            await ApiService.changeAdminPassword(currentPassword, newPassword);
            
            Utils.showNotification('✅ Contraseña actualizada correctamente', 'success');
            
            // Actualizar estado del usuario
            AppState.user.firstLogin = false;
            localStorage.setItem('finpro_admin_user', JSON.stringify(AppState.user));
            
            this.showMainApp();
            return true;
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    logout() {
        AppState.user = null;
        AppState.token = null;
        AppState.dashboardData = null;
        
        localStorage.removeItem('finpro_admin_token');
        localStorage.removeItem('finpro_admin_user');
        
        Utils.showNotification('👋 Sesión cerrada correctamente', 'info');
        this.showLoginView();
    },

    showLoginView() {
        document.getElementById('login-view').classList.add('active');
        document.getElementById('main-view').classList.remove('active');
    },

    showMainApp() {
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('main-view').classList.add('active');
        
        document.getElementById('user-name').textContent = AppState.user.name;
        document.getElementById('user-role').textContent = `(${AppState.user.role})`;
        
        // Mostrar opción de cambiar contraseña en el header
        this.addPasswordChangeOption();
        
        DataManager.loadInitialData();
    },

    showChangePasswordModal() {
        showModal('change-password-modal');
    },

    addPasswordChangeOption() {
        const changePassBtn = document.getElementById('change-password-btn');
        if (changePassBtn) {
            changePassBtn.style.display = 'block';
        }
    }
};

// Gestión de Datos
const DataManager = {
    async loadInitialData() {
        try {
            Utils.setLoading(true);
            const dashboardData = await ApiService.getDashboard();
            
            AppState.dashboardData = dashboardData;
            AppState.accounts = dashboardData.accounts || [];
            AppState.transactions = dashboardData.recentTransactions || [];
            AppState.categories = dashboardData.categories || [];
            
            this.renderDashboard();
            this.updateAccountsSelect();
            this.updateCategoriesSelect();
            
            // Si es admin, cargar lista de usuarios
            if (AppState.user.role === 'admin') {
                await this.loadUsers();
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            Utils.setLoading(false);
        }
    },

    renderDashboard() {
        const data = AppState.dashboardData;
        if (!data) return;

        document.getElementById('total-balance').textContent = 
            Utils.formatMoney(data.summary?.total_balance || 0);
        document.getElementById('monthly-income').textContent = 
            Utils.formatMoney(data.summary?.monthly_income || 0);
        document.getElementById('monthly-expenses').textContent = 
            Utils.formatMoney(data.summary?.monthly_expenses || 0);

        this.renderAccounts(data.accounts, 'accounts-list');
        this.renderTransactions(data.recentTransactions, 'recent-transactions');
    },

    renderAccounts(accounts, containerId) {
        const container = document.getElementById(containerId);
        if (!accounts || accounts.length === 0) {
            container.innerHTML = '<div class="no-data">No hay cuentas registradas</div>';
            return;
        }

        container.innerHTML = accounts.map(account => `
            <div class="account-item">
                <div class="account-info">
                    <h4>${account.name}</h4>
                    <p>${account.currency} • ${account.type === 'asset' ? 'Activo' : 'Pasivo'}</p>
                </div>
                <div class="account-balance ${account.current_balance < 0 ? 'negative' : ''}">
                    ${Utils.formatMoney(account.current_balance, account.currency)}
                </div>
            </div>
        `).join('');
    },

    renderTransactions(transactions, containerId) {
        const container = document.getElementById(containerId);
        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<div class="no-data">No hay movimientos recientes</div>';
            return;
        }

        container.innerHTML = transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-header">
                        <span class="transaction-title">${transaction.description || 'Sin descripción'}</span>
                        <span class="transaction-amount ${transaction.type}">
                            ${transaction.type === 'income' ? '+' : '-'}${Utils.formatMoney(transaction.amount, transaction.currency)}
                        </span>
                    </div>
                    <div class="transaction-details">
                        <span>${transaction.category}</span>
                        <span>${Utils.formatDate(transaction.date)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    async loadUsers() {
        try {
            const users = await ApiService.getUsers();
            AppState.users = users;
            this.renderUsers(users);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    },

    renderUsers(users) {
        const container = document.getElementById('users-list');
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="no-data">No hay usuarios registrados</div>';
            return;
        }

        container.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <h4>${user.name} <span class="user-role-badge">${user.role}</span></h4>
                    <p>${user.email}</p>
                    <p class="user-permissions">${user.canEdit ? 'Puede editar finanzas' : 'Solo lectura'}</p>
                </div>
                <div class="user-actions">
                    <button class="btn-icon" onclick="DataManager.toggleUserEdit('${user.id}', ${!user.canEdit})" 
                            title="${user.canEdit ? 'Quitar permisos' : 'Dar permisos'}">
                        ${user.canEdit ? '🔒' : '✏️'}
                    </button>
                </div>
            </div>
        `).join('');
    },

    async toggleUserEdit(userId, canEdit) {
        try {
            Utils.setLoading(true);
            await ApiService.updateUser(userId, { canEdit });
            Utils.showNotification('✅ Permisos actualizados correctamente', 'success');
            await this.loadUsers();
        } catch (error) {
            Utils.showNotification(error.message, 'error');
        } finally {
            Utils.setLoading(false);
        }
    },

    async createUser(userData) {
        try {
            Utils.setLoading(true);
            await ApiService.createUser(userData);
            Utils.showNotification('✅ Usuario creado exitosamente', 'success');
            await this.loadUsers();
            return true;
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    updateAccountsSelect() {
        const select = document.getElementById('transaction-account');
        if (!select) return;

        select.innerHTML = AppState.accounts.map(account => `
            <option value="${account.id}">${account.name} (${account.currency})</option>
        `).join('');
    },

    updateCategoriesSelect() {
        const select = document.getElementById('transaction-category');
        if (!select) return;

        const transactionType = document.getElementById('transaction-type').value;
        const filteredCategories = AppState.categories.filter(cat => cat.type === transactionType);
        
        select.innerHTML = filteredCategories.map(category => `
            <option value="${category.name}">${category.name}</option>
        `).join('');
    },

    async addTransaction(transactionData) {
        try {
            Utils.setLoading(true);
            await ApiService.saveTransaction(transactionData);
            Utils.showNotification('✅ Movimiento guardado exitosamente', 'success');
            await this.loadInitialData();
            return true;
        } catch (error) {
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    async addAccount(accountData) {
        try {
            Utils.setLoading(true);
            await ApiService.saveAccount(accountData);
            Utils.showNotification('✅ Cuenta creada exitosamente', 'success');
            await this.loadInitialData();
            return true;
        } catch (error) {
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    async loadTransactionsPage() {
        try {
            Utils.setLoading(true);
            const transactions = await ApiService.getTransactions();
            this.renderTransactions(transactions, 'all-transactions');
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            Utils.setLoading(false);
        }
    },

    async loadAccountsPage() {
        try {
            Utils.setLoading(true);
            const accounts = await ApiService.getAccounts();
            this.renderAccounts(accounts, 'all-accounts');
        } catch (error) {
            console.error('Error loading accounts:', error);
        } finally {
            Utils.setLoading(false);
        }
    }
};

// Gestión de Navegación
const NavigationManager = {
    switchPage(page) {
        AppState.currentView = page;
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.remove('active');
        });
        document.getElementById(`${page}-page`).classList.add('active');
        
        const titles = {
            dashboard: 'Panel Admin',
            users: 'Gestión de Usuarios',
            transactions: 'Movimientos',
            accounts: 'Cuentas'
        };
        document.getElementById('current-page-title').textContent = titles[page];
        
        this.loadPageData(page);
    },

    loadPageData(page) {
        switch (page) {
            case 'transactions':
                DataManager.loadTransactionsPage();
                break;
            case 'accounts':
                DataManager.loadAccountsPage();
                break;
            case 'users':
                DataManager.loadUsers();
                break;
            case 'dashboard':
            default:
                DataManager.renderDashboard();
                break;
        }
    }
};

// Gestión de Modales
const ModalManager = {
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            this.prepareModal(modalId);
        }
    },

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        this.clearForms();
    },

    prepareModal(modalId) {
        switch (modalId) {
            case 'add-transaction-modal':
                this.prepareTransactionModal();
                break;
            case 'add-account-modal':
                this.prepareAccountModal();
                break;
        }
    },

    prepareTransactionModal() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('transaction-date').value = today;
        
        const typeSelect = document.getElementById('transaction-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                DataManager.updateCategoriesSelect();
            });
        }
        
        DataManager.updateCategoriesSelect();
    },

    prepareAccountModal() {
        document.getElementById('account-balance').value = '0.00';
    },

    clearForms() {
        const forms = ['transaction-form', 'account-form', 'add-user-form', 'change-password-form'];
        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) form.reset();
        });
    }
};

// Manejadores de Eventos
const EventHandlers = {
    init() {
        this.initAuthEvents();
        this.initNavigationEvents();
        this.initModalEvents();
        this.initFormEvents();
    },

    initAuthEvents() {
        // Login Admin
        const loginForm = document.getElementById('admin-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('admin-email').value;
                const password = document.getElementById('admin-password').value;
                await AuthManager.adminLogin(email, password);
            });
        }

        // Cambio de contraseña
        const changePassForm = document.getElementById('change-password-form');
        if (changePassForm) {
            changePassForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const currentPassword = document.getElementById('current-password').value;
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;
                await AuthManager.changePassword(currentPassword, newPassword, confirmPassword);
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                AuthManager.logout();
            });
        }

        // Test connection
        const testConnectionBtn = document.getElementById('test-connection-btn');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', async () => {
                Utils.setLoading(true);
                const result = await ApiService.testConnection();
                Utils.setLoading(false);
                Utils.showNotification(result, result.includes('✅') ? 'success' : 'error');
            });
        }
    },

    initNavigationEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.getAttribute('data-page');
                NavigationManager.switchPage(page);
            });
        });
    },

    initModalEvents() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    ModalManager.closeModal();
                }
            });
        });
    },

    initFormEvents() {
        // Formulario de transacción
        const transactionForm = document.getElementById('transaction-form');
        if (transactionForm) {
            transactionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = {
                    type: document.getElementById('transaction-type').value,
                    accountId: document.getElementById('transaction-account').value,
                    category: document.getElementById('transaction-category').value,
                    amount: parseFloat(document.getElementById('transaction-amount').value),
                    description: document.getElementById('transaction-description').value,
                    date: document.getElementById('transaction-date').value
                };
                if (await DataManager.addTransaction(formData)) {
                    closeModal();
                }
            });
        }

        // Formulario de cuenta
        const accountForm = document.getElementById('account-form');
        if (accountForm) {
            accountForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = {
                    name: document.getElementById('account-name').value,
                    currency: document.getElementById('account-currency').value,
                    type: document.getElementById('account-type').value,
                    initialBalance: parseFloat(document.getElementById('account-balance').value)
                };
                if (await DataManager.addAccount(formData)) {
                    closeModal();
                }
            });
        }

        // Formulario de nuevo usuario
        const addUserForm = document.getElementById('add-user-form');
        if (addUserForm) {
            addUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = {
                    name: document.getElementById('user-name').value,
                    email: document.getElementById('user-email').value,
                    password: document.getElementById('user-password').value,
                    canEdit: document.getElementById('user-can-edit').checked
                };
                if (await DataManager.createUser(formData)) {
                    closeModal();
                }
            });
        }
    }
};

// Funciones globales para onclick
function showModal(modalId) {
    ModalManager.showModal(modalId);
}

function closeModal() {
    ModalManager.closeModal();
}

// Inicialización de la aplicación
function initApp() {
    console.log('🚀 Inicializando FinPro Admin...');
    
    // Verificar autenticación
    if (AuthManager.checkAuth()) {
        console.log('✅ Usuario autenticado encontrado');
        AuthManager.showMainApp();
    } else {
        console.log('🔐 No hay usuario autenticado, mostrando login');
        AuthManager.showLoginView();
    }

    // Inicializar event listeners
    try {
        EventHandlers.init();
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar event handlers:', error);
    }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
