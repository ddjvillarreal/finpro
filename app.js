// Configuración de la aplicación - CON TU URL
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbyfGbp-r64fRN_rr-Pwls_7Y-4CpQfy7H62pUG31m2LWn2IOalcRcFK_Ut55Pwlbom-/exec',
    APP_NAME: 'FinPro',
    VERSION: '1.0.1'
};

// Estado global de la aplicación
let AppState = {
    user: null,
    token: null,
    dashboardData: null,
    accounts: [],
    transactions: [],
    categories: [],
    currentView: 'dashboard',
    loading: false
};

// Utilidades
const Utils = {
    // Formatear dinero
    formatMoney(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    },

    // Formatear fecha
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    // Generar ID único
    generateId(prefix = '') {
        return prefix + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Mostrar notificación
    showNotification(message, type = 'info') {
        // Remover notificaciones existentes
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Estilos para la notificación
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 300px;
        `;

        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    },

    // Mostrar/ocultar loading
    setLoading(loading) {
        const loadingEl = document.getElementById('loading');
        if (loading) {
            loadingEl.classList.remove('hidden');
        } else {
            loadingEl.classList.add('hidden');
        }
        AppState.loading = loading;
    }
};

// Servicio de API
const ApiService = {
    async request(action, data = {}) {
        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    data: {
                        ...data,
                        token: AppState.token
                    }
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Error en la solicitud');
            }

            return result.data;
        } catch (error) {
            console.error('API Error:', error);
            Utils.showNotification(error.message || 'Error de conexión', 'error');
            throw error;
        }
    },

    // Autenticación
    async login(email, password) {
        return this.request('login', { email, password });
    },

    async register(userData) {
        return this.request('register', userData);
    },

    // Datos
    async getDashboard() {
        return this.request('get-dashboard');
    },

    async saveTransaction(transaction) {
        return this.request('save-transaction', transaction);
    },

    async getTransactions() {
        return this.request('get-transactions');
    },

    async saveAccount(account) {
        return this.request('save-account', account);
    },

    async getAccounts() {
        return this.request('get-accounts');
    },

    async getCategories() {
        return this.request('get-categories');
    }
};

// Gestión de Autenticación - CORREGIDO
const AuthManager = {
    // Verificar si hay sesión activa
    checkAuth() {
        const token = localStorage.getItem('finpro_token');
        const user = localStorage.getItem('finpro_user');
        
        if (token && user) {
            AppState.token = token;
            AppState.user = JSON.parse(user);
            return true;
        }
        return false;
    },

    // Iniciar sesión
    async login(email, password) {
        try {
            Utils.setLoading(true);
            const result = await ApiService.login(email, password);
            
            AppState.user = result.user;
            AppState.token = result.token;
            
            localStorage.setItem('finpro_token', result.token);
            localStorage.setItem('finpro_user', JSON.stringify(result.user));
            
            Utils.showNotification(`Bienvenido ${result.user.name}`, 'success');
            this.showMainApp();
            return true;
        } catch (error) {
            Utils.showNotification('Credenciales incorrectas', 'error');
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    // Registrar nuevo usuario
    async register(userData) {
        try {
            Utils.setLoading(true);
            const result = await ApiService.register(userData);
            
            Utils.showNotification('Cuenta creada exitosamente. Ahora inicia sesión.', 'success');
            this.showLoginForm();
            return true;
        } catch (error) {
            Utils.showNotification('Error al crear la cuenta: ' + error.message, 'error');
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    // Cerrar sesión
    logout() {
        AppState.user = null;
        AppState.token = null;
        AppState.dashboardData = null;
        
        localStorage.removeItem('finpro_token');
        localStorage.removeItem('finpro_user');
        
        this.showLoginView();
    },

    // Mostrar vista de login - CORREGIDO
    showLoginView() {
        document.getElementById('login-view').classList.add('active');
        document.getElementById('main-view').classList.remove('active');
        this.showLoginForm();
    },

    // Mostrar formulario de login específicamente
    showLoginForm() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('toggle-auth').textContent = '¿No tienes cuenta? Regístrate';
        
        // Limpiar formularios
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
    },

    // Mostrar formulario de registro
    showRegisterForm() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('toggle-auth').textContent = '¿Ya tienes cuenta? Inicia sesión';
    },

    // Mostrar aplicación principal
    showMainApp() {
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('main-view').classList.add('active');
        document.getElementById('user-name').textContent = AppState.user.name;
        
        // Cargar datos iniciales
        DataManager.loadInitialData();
    },

    // Alternar entre login y registro - CORREGIDO
    toggleAuthMode() {
        if (document.getElementById('login-form').classList.contains('hidden')) {
            this.showLoginForm();
        } else {
            this.showRegisterForm();
        }
    }
};

// Gestión de Datos
const DataManager = {
    // Cargar todos los datos iniciales
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
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            Utils.setLoading(false);
        }
    },

    // Renderizar dashboard
    renderDashboard() {
        const data = AppState.dashboardData;
        if (!data) return;

        // Actualizar resumen
        document.getElementById('total-balance').textContent = 
            Utils.formatMoney(data.summary?.total_balance || 0);
        document.getElementById('monthly-income').textContent = 
            Utils.formatMoney(data.summary?.monthly_income || 0);
        document.getElementById('monthly-expenses').textContent = 
            Utils.formatMoney(data.summary?.monthly_expenses || 0);

        // Renderizar cuentas
        this.renderAccounts(data.accounts, 'accounts-list');
        
        // Renderizar transacciones recientes
        this.renderTransactions(data.recentTransactions, 'recent-transactions');
    },

    // Renderizar lista de cuentas
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

    // Renderizar lista de transacciones
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

    // Actualizar select de cuentas en formularios
    updateAccountsSelect() {
        const select = document.getElementById('transaction-account');
        if (!select) return;

        select.innerHTML = AppState.accounts.map(account => `
            <option value="${account.id}">${account.name} (${account.currency})</option>
        `).join('');
    },

    // Actualizar select de categorías en formularios
    updateCategoriesSelect() {
        const select = document.getElementById('transaction-category');
        if (!select) return;

        // Filtrar categorías por tipo de transacción
        const transactionType = document.getElementById('transaction-type').value;
        const filteredCategories = AppState.categories.filter(cat => cat.type === transactionType);
        
        select.innerHTML = filteredCategories.map(category => `
            <option value="${category.name}">${category.name}</option>
        `).join('');
    },

    // Agregar nueva transacción
    async addTransaction(transactionData) {
        try {
            Utils.setLoading(true);
            const result = await ApiService.saveTransaction(transactionData);
            
            Utils.showNotification('Movimiento guardado exitosamente', 'success');
            
            // Recargar datos
            await this.loadInitialData();
            
            // Si estamos en la vista de transacciones, recargarla
            if (AppState.currentView === 'transactions') {
                this.loadTransactionsPage();
            }
            
            return true;
        } catch (error) {
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    // Agregar nueva cuenta
    async addAccount(accountData) {
        try {
            Utils.setLoading(true);
            const result = await ApiService.saveAccount(accountData);
            
            Utils.showNotification('Cuenta creada exitosamente', 'success');
            
            // Recargar datos
            await this.loadInitialData();
            
            // Si estamos en la vista de cuentas, recargarla
            if (AppState.currentView === 'accounts') {
                this.loadAccountsPage();
            }
            
            return true;
        } catch (error) {
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    // Cargar página de transacciones
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

    // Cargar página de cuentas
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
    },

    // Cargar página de estadísticas
    loadStatsPage() {
        const expenseChart = document.getElementById('expense-chart');
        const flowChart = document.getElementById('flow-chart');
        
        if (AppState.transactions.length === 0) {
            expenseChart.innerHTML = '<p>No hay datos suficientes para mostrar estadísticas</p>';
            flowChart.innerHTML = '<p>No hay datos suficientes para mostrar estadísticas</p>';
        } else {
            expenseChart.innerHTML = '<p>Gráfico de distribución de gastos (próximamente)</p>';
            flowChart.innerHTML = '<p>Gráfico de flujo mensual (próximamente)</p>';
        }
    }
};

// Gestión de Navegación
const NavigationManager = {
    // Cambiar de página
    switchPage(page) {
        // Actualizar estado
        AppState.currentView = page;
        
        // Actualizar navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        // Actualizar páginas
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.remove('active');
        });
        document.getElementById(`${page}-page`).classList.add('active');
        
        // Actualizar título
        const titles = {
            dashboard: 'Dashboard',
            transactions: 'Movimientos',
            accounts: 'Cuentas',
            stats: 'Estadísticas'
        };
        document.getElementById('current-page-title').textContent = titles[page];
        
        // Cargar datos específicos de la página
        this.loadPageData(page);
    },

    // Cargar datos específicos de la página
    loadPageData(page) {
        switch (page) {
            case 'transactions':
                DataManager.loadTransactionsPage();
                break;
            case 'accounts':
                DataManager.loadAccountsPage();
                break;
            case 'stats':
                DataManager.loadStatsPage();
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
    // Mostrar modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            
            // Preparar modal según tipo
            this.prepareModal(modalId);
        }
    },

    // Cerrar modal
    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        // Limpiar formularios
        this.clearForms();
    },

    // Preparar modal según tipo
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

    // Preparar modal de transacción
    prepareTransactionModal() {
        // Establecer fecha actual
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('transaction-date').value = today;
        
        // Actualizar categorías según tipo seleccionado
        document.getElementById('transaction-type').addEventListener('change', function() {
            DataManager.updateCategoriesSelect();
        });
        
        // Inicializar categorías
        DataManager.updateCategoriesSelect();
    },

    // Preparar modal de cuenta
    prepareAccountModal() {
        // Establecer saldo inicial en 0
        document.getElementById('account-balance').value = '0.00';
    },

    // Limpiar formularios
    clearForms() {
        document.getElementById('transaction-form').reset();
        document.getElementById('account-form').reset();
    }
};

// Manejadores de Eventos
const EventHandlers = {
    // Inicializar todos los event listeners
    init() {
        this.initAuthEvents();
        this.initNavigationEvents();
        this.initModalEvents();
        this.initFormEvents();
    },

    // Eventos de autenticación
    initAuthEvents() {
        // Login
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            await AuthManager.login(email, password);
        });

        // Registro
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const userData = {
                name: document.getElementById('register-name').value,
                email: document.getElementById('register-email').value,
                password: document.getElementById('register-password').value
            };
            await AuthManager.register(userData);
        });

        // Alternar entre login/registro
        document.getElementById('toggle-auth').addEventListener('click', () => {
            AuthManager.toggleAuthMode();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            AuthManager.logout();
        });
    },

    // Eventos de navegación
    initNavigationEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.getAttribute('data-page');
                NavigationManager.switchPage(page);
            });
        });
    },

    // Eventos de modales
    initModalEvents() {
        // Cerrar modales al hacer clic fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    ModalManager.closeModal();
                }
            });
        });
    },

    // Eventos de formularios
    initFormEvents() {
        // Formulario de transacción
        document.getElementById('transaction-form').addEventListener('submit', async (e) => {
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
                ModalManager.closeModal();
            }
        });

        // Formulario de cuenta
        document.getElementById('account-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('account-name').value,
                currency: document.getElementById('account-currency').value,
                type: document.getElementById('account-type').value,
                initialBalance: parseFloat(document.getElementById('account-balance').value)
            };

            if (await DataManager.addAccount(formData)) {
                ModalManager.closeModal();
            }
        });
    }
};

// Funciones globales para onclick
window.showModal = function(modalId) {
    ModalManager.showModal(modalId);
};

window.closeModal = function() {
    ModalManager.closeModal();
};

// Inicialización de la aplicación
function initApp() {
    // Verificar autenticación
    if (AuthManager.checkAuth()) {
        AuthManager.showMainApp();
    } else {
        AuthManager.showLoginView();
    }

    // Inicializar event listeners
    EventHandlers.init();

    console.log(`${CONFIG.APP_NAME} v${CONFIG.VERSION} inicializada`);
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
