// Configuración de la aplicación
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbw1EwEVkeEQmTaxrcJhOz1WoZ8dU2mi1BfvQYs9bKdrYbKUmWFty85eAZcYA0gI86XS/exec',
    APP_NAME: 'FinPro',
    VERSION: '2.0.0'
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

    // Mostrar notificación mejorada
    showNotification(message, type = 'info') {
        // Remover notificaciones existentes
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Iconos según tipo
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
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            min-width: 300px;
            border-left: 4px solid ${type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : type === 'warning' ? '#d97706' : '#2563eb'};
        `;

        const content = notification.querySelector('.notification-content');
        content.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 12px;
        `;

        const messageEl = notification.querySelector('.notification-message');
        messageEl.style.cssText = `
            flex: 1;
            font-size: 14px;
            line-height: 1.4;
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        document.body.appendChild(notification);
        
        // Auto-remover después de 6 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 6000);
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
    },

    // Validar email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};

// Servicio de API - VERSIÓN CORREGIDA
const ApiService = {
    async request(action, data = {}) {
        try {
            console.log(`📡 Enviando solicitud a API: ${action}`, data);
            
            // Verificar conexión a internet
            if (!navigator.onLine) {
                throw new Error('🔌 No hay conexión a internet. Verifica tu conexión.');
            }
            
            const requestData = {
                action: action,
                data: data
            };

            // Si hay token, lo agregamos (excepto para login y register)
            if (AppState.token && action !== 'login' && action !== 'register') {
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
                throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                let errorMessage = result.error || 'Error desconocido en el servidor';
                
                // Mapeo de errores comunes
                const errorMap = {
                    'User already exists': 'Ya existe un usuario con este email',
                    'Invalid credentials': 'Email o contraseña incorrectos',
                    'Token expirado': 'Tu sesión ha expirado. Por favor inicia sesión nuevamente',
                    'Token inválido': 'Sesión inválida. Por favor inicia sesión nuevamente',
                    'Failed to fetch': 'No se puede conectar al servidor',
                    'NetworkError': 'Error de red',
                    'All fields are required': 'Todos los campos son requeridos',
                    'Invalid email format': 'El formato del email no es válido',
                    'Password must be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres'
                };

                // Buscar coincidencias en el mapa de errores
                for (const [key, value] of Object.entries(errorMap)) {
                    if (errorMessage.includes(key)) {
                        errorMessage = value;
                        break;
                    }
                }

                throw new Error(errorMessage);
            }

            console.log(`✅ Respuesta exitosa de API: ${action}`, result.data);
            return result.data;
            
        } catch (error) {
            console.error('❌ Error en API:', error);
            
            // Mensajes de error amigables en español con diagnóstico
            let userFriendlyMessage = error.message;
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                userFriendlyMessage = 
                    '🔌 Error de conexión al servidor\n\n' +
                    'Posibles causas:\n' +
                    '• Google Apps Script no está desplegado correctamente\n' +
                    '• La URL de la API es incorrecta\n' +
                    '• Problemas de red o firewall\n\n' +
                    'Solución:\n' +
                    '1. Ve a script.google.com\n' +
                    '2. Publica como "Aplicación web"\n' +
                    '3. Configura: "Ejecutar como: Yo", "Acceso: Cualquiera"\n' +
                    '4. Actualiza la URL en app.js';
            } else if (error.message.includes('404')) {
                userFriendlyMessage = '🔍 URL no encontrada. Verifica que la URL de Google Apps Script sea correcta.';
            } else if (error.message.includes('500')) {
                userFriendlyMessage = '⚙️ Error interno del servidor. Revisa los logs de Google Apps Script.';
            } else if (error.message.includes('403')) {
                userFriendlyMessage = '🔐 Acceso denegado. Verifica que Google Apps Script esté configurado para "Cualquier persona".';
            }

            Utils.showNotification(userFriendlyMessage, 'error');
            throw error;
        }
    },

    // Autenticación
    async login(email, password) {
        if (!email || !password) {
            throw new Error('❌ Email y contraseña son requeridos');
        }
        
        if (!Utils.isValidEmail(email)) {
            throw new Error('❌ El formato del email no es válido');
        }
        
        return this.request('login', { email, password });
    },

    async register(userData) {
        if (!userData.email || !userData.password || !userData.name) {
            throw new Error('❌ Todos los campos son requeridos');
        }
        
        if (!Utils.isValidEmail(userData.email)) {
            throw new Error('❌ El formato del email no es válido');
        }
        
        if (userData.password.length < 6) {
            throw new Error('❌ La contraseña debe tener al menos 6 caracteres');
        }
        
        return this.request('register', userData);
    },

    // Datos
    async getDashboard() {
        return this.request('get-dashboard');
    },

    async saveTransaction(transaction) {
        if (!transaction.type || !transaction.accountId || !transaction.amount) {
            throw new Error('❌ Tipo, cuenta y monto son requeridos');
        }
        
        if (isNaN(transaction.amount) || transaction.amount <= 0) {
            throw new Error('❌ El monto debe ser un número positivo');
        }
        
        return this.request('save-transaction', transaction);
    },

    async getTransactions() {
        return this.request('get-transactions');
    },

    async saveAccount(account) {
        if (!account.name || !account.currency || !account.type) {
            throw new Error('❌ Nombre, moneda y tipo son requeridos');
        }
        
        if (isNaN(account.initialBalance)) {
            throw new Error('❌ El saldo inicial debe ser un número válido');
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
    // Verificar si hay sesión activa
    checkAuth() {
        const token = localStorage.getItem('finpro_token');
        const user = localStorage.getItem('finpro_user');
        
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

    // Iniciar sesión
    async login(email, password) {
        try {
            Utils.setLoading(true);
            const result = await ApiService.login(email, password);
            
            AppState.user = result.user;
            AppState.token = result.token;
            
            localStorage.setItem('finpro_token', result.token);
            localStorage.setItem('finpro_user', JSON.stringify(result.user));
            
            Utils.showNotification(`✅ Bienvenido ${result.user.name}`, 'success');
            this.showMainApp();
            return true;
        } catch (error) {
            // El error ya fue mostrado por ApiService
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
            
            Utils.showNotification('✅ Cuenta creada exitosamente. Ahora inicia sesión.', 'success');
            this.showLoginForm();
            return true;
        } catch (error) {
            // El error ya fue mostrado por ApiService
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
        
        Utils.showNotification('👋 Sesión cerrada correctamente', 'info');
        this.showLoginView();
    },

    // Mostrar vista de login
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

    // Alternar entre login y registro
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
            
            Utils.showNotification('✅ Movimiento guardado exitosamente', 'success');
            
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
            
            Utils.showNotification('✅ Cuenta creada exitosamente', 'success');
            
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
        const typeSelect = document.getElementById('transaction-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', function() {
                DataManager.updateCategoriesSelect();
            });
        }
        
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
        const transactionForm = document.getElementById('transaction-form');
        const accountForm = document.getElementById('account-form');
        
        if (transactionForm) transactionForm.reset();
        if (accountForm) accountForm.reset();
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
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                await AuthManager.login(email, password);
            });
        }

        // Registro
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userData = {
                    name: document.getElementById('register-name').value,
                    email: document.getElementById('register-email').value,
                    password: document.getElementById('register-password').value
                };
                await AuthManager.register(userData);
            });
        }

        // Alternar entre login/registro
        const toggleAuth = document.getElementById('toggle-auth');
        if (toggleAuth) {
            toggleAuth.addEventListener('click', () => {
                AuthManager.toggleAuthMode();
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                AuthManager.logout();
            });
        }
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
                    ModalManager.closeModal();
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
                    ModalManager.closeModal();
                }
            });
        }
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
    console.log('🚀 Inicializando FinPro...');
    
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
