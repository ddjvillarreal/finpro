// Configuración de la aplicación
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbwJt5Y7Ni7p77GuFT4Q56XqsF0Yq0Qn17ty1Z9YyknP-3MtiAErRS34qBv7Fy7_YaP6/exec',
    APP_NAME: 'FinPro Admin',
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
        // Eliminar notificaciones existentes
        document.querySelectorAll('.notification').forEach(n => n.remove());

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

        // Estilos inline para la notificación
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
            minWidth: '300px'
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
    }
};

// Servicio de API - VERSIÓN SIMPLIFICADA
const ApiService = {
    async request(action, data = {}) {
        try {
            console.log(`📡 Enviando solicitud: ${action}`, data);
            
            if (!navigator.onLine) {
                throw new Error('🔌 No hay conexión a internet');
            }
            
            // Preparar datos
            const requestData = {
                action: action,
                data: data
            };

            // Agregar token si existe
            if (AppState.token && action !== 'admin-login') {
                requestData.data.token = AppState.token;
            }
            
            // Usar JSONP como método principal (más compatible)
            return await this.jsonpRequest(action, data);
            
        } catch (error) {
            console.error('❌ Error en API:', error);
            Utils.showNotification(error.message, 'error');
            throw error;
        }
    },

    // JSONP Request
    jsonpRequest(action, data = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout en conexión'));
            }, 15000);
            
            // Configurar callback global
            window[callbackName] = function(response) {
                cleanup();
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error || 'Error en el servidor'));
                }
            };
            
            function cleanup() {
                clearTimeout(timeoutId);
                delete window[callbackName];
                const existingScript = document.getElementById('jsonp-script');
                if (existingScript) {
                    existingScript.remove();
                }
            }
            
            // Construir URL
            const params = new URLSearchParams();
            params.append('action', action);
            params.append('callback', callbackName);
            
            // Agregar datos
            if (AppState.token && action !== 'admin-login') {
                params.append('token', AppState.token);
            }
            
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    params.append(key, data[key]);
                }
            });
            
            const url = `${CONFIG.API_URL}?${params.toString()}`;
            
            // Crear y agregar script
            const script = document.createElement('script');
            script.id = 'jsonp-script';
            script.src = url;
            script.onerror = () => {
                cleanup();
                reject(new Error('Error de conexión con el servidor'));
            };
            
            document.head.appendChild(script);
        });
    },

    // Métodos específicos
    async testConnection() {
        try {
            const result = await this.request('test-connection', {});
            return '✅ Conexión exitosa: ' + (result.message || 'API funcionando');
        } catch (error) {
            return '❌ Error de conexión: ' + error.message;
        }
    },

    async adminLogin(email, password) {
        return this.request('admin-login', { email, password });
    },

    async changeAdminPassword(currentPassword, newPassword) {
        return this.request('change-admin-password', { currentPassword, newPassword });
    },

    async createUser(userData) {
        return this.request('create-user', userData);
    },

    async getUsers() {
        return this.request('get-users');
    },

    async updateUser(userId, updates) {
        return this.request('update-user', { userId, ...updates });
    },

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

// Gestión de Autenticación
const AuthManager = {
    checkAuth() {
        try {
            const token = localStorage.getItem('finpro_admin_token');
            const user = localStorage.getItem('finpro_admin_user');
            
            if (token && user) {
                AppState.token = token;
                AppState.user = JSON.parse(user);
                console.log('✅ Usuario encontrado en localStorage:', AppState.user.name);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error checking auth:', error);
            this.logout();
            return false;
        }
    },

    async adminLogin(email, password) {
        try {
            Utils.setLoading(true);
            console.log('🔐 Intentando login con:', email);
            
            const result = await ApiService.adminLogin(email, password);
            
            AppState.user = result.user;
            AppState.token = result.token;
            
            // Guardar en localStorage
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
            Utils.showNotification('Error en login: ' + error.message, 'error');
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
            
            // Actualizar estado
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
        localStorage.removeItem('finpro_admin_token');
        localStorage.removeItem('finpro_admin_user');
        
        Utils.showNotification('👋 Sesión cerrada', 'info');
        this.showLoginView();
    },

    showLoginView() {
        document.getElementById('login-view').classList.add('active');
        document.getElementById('main-view').classList.remove('active');
    },

    showMainApp() {
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('main-view').classList.add('active');
        
        // Actualizar UI
        if (AppState.user) {
            document.getElementById('user-name').textContent = AppState.user.name;
            document.getElementById('user-role').textContent = `(${AppState.user.role})`;
        }
        
        // Mostrar botón de cambio de contraseña si es primer login
        if (AppState.user && AppState.user.firstLogin) {
            const changePassBtn = document.getElementById('change-password-btn');
            if (changePassBtn) changePassBtn.style.display = 'block';
        }
        
        // Cargar datos iniciales
        DataManager.loadInitialData();
    },

    showChangePasswordModal() {
        showModal('change-password-modal');
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
            this.updateFormSelects();
            
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

        // Actualizar resumen
        document.getElementById('total-balance').textContent = 
            Utils.formatMoney(data.summary?.total_balance || 0);
        document.getElementById('monthly-income').textContent = 
            Utils.formatMoney(data.summary?.monthly_income || 0);
        document.getElementById('monthly-expenses').textContent = 
            Utils.formatMoney(data.summary?.monthly_expenses || 0);

        // Renderizar cuentas y transacciones
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
            container.innerHTML = '<div class="no-data">No hay movimientos</div>';
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
            container.innerHTML = '<div class="no-data">No hay usuarios</div>';
            return;
        }

        container.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <h4>${user.name} <span class="user-role-badge">${user.role}</span></h4>
                    <p>${user.email}</p>
                    <p class="user-permissions">${user.canEdit ? 'Puede editar' : 'Solo lectura'}</p>
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

    updateFormSelects() {
        // Actualizar select de cuentas
        const accountSelect = document.getElementById('transaction-account');
        if (accountSelect) {
            accountSelect.innerHTML = AppState.accounts.map(account => 
                `<option value="${account.id}">${account.name} (${account.currency})</option>`
            ).join('');
        }
        
        // Actualizar select de categorías
        this.updateCategoriesSelect();
    },

    updateCategoriesSelect() {
        const categorySelect = document.getElementById('transaction-category');
        if (!categorySelect) return;

        const type = document.getElementById('transaction-type')?.value || 'expense';
        const filtered = AppState.categories.filter(cat => cat.type === type);
        
        categorySelect.innerHTML = filtered.map(cat => 
            `<option value="${cat.name}">${cat.name}</option>`
        ).join('');
    },

    // Métodos para crear datos
    async createUser(userData) {
        try {
            Utils.setLoading(true);
            await ApiService.createUser(userData);
            Utils.showNotification('✅ Usuario creado', 'success');
            await this.loadUsers();
            return true;
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    async addTransaction(formData) {
        try {
            Utils.setLoading(true);
            await ApiService.saveTransaction(formData);
            Utils.showNotification('✅ Movimiento guardado', 'success');
            await this.loadInitialData();
            return true;
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    async addAccount(formData) {
        try {
            Utils.setLoading(true);
            await ApiService.saveAccount(formData);
            Utils.showNotification('✅ Cuenta creada', 'success');
            await this.loadInitialData();
            return true;
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            return false;
        } finally {
            Utils.setLoading(false);
        }
    },

    async toggleUserEdit(userId, canEdit) {
        try {
            Utils.setLoading(true);
            await ApiService.updateUser(userId, { canEdit });
            Utils.showNotification('✅ Permisos actualizados', 'success');
            await this.loadUsers();
        } catch (error) {
            Utils.showNotification(error.message, 'error');
        } finally {
            Utils.setLoading(false);
        }
    }
};

// Navegación
const NavigationManager = {
    switchPage(page) {
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
            dashboard: 'Panel Admin',
            users: 'Gestión de Usuarios',
            transactions: 'Movimientos',
            accounts: 'Cuentas'
        };
        document.getElementById('current-page-title').textContent = titles[page] || 'Panel Admin';
        
        AppState.currentView = page;
    }
};

// Inicialización de Eventos
function initEventHandlers() {
    // Login form
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            await AuthManager.adminLogin(email, password);
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => AuthManager.logout());
    }

    // Test connection
    const testBtn = document.getElementById('test-connection-btn');
    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            Utils.setLoading(true);
            const result = await ApiService.testConnection();
            Utils.setLoading(false);
            Utils.showNotification(result, result.includes('✅') ? 'success' : 'error');
        });
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            NavigationManager.switchPage(page);
        });
    });

    // Modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    });

    // Form handlers
    initFormHandlers();
}

function initFormHandlers() {
    // Change password
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

    // Add user
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

    // Add transaction
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        // Cambio de tipo actualiza categorías
        const typeSelect = document.getElementById('transaction-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                DataManager.updateCategoriesSelect();
            });
        }

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

    // Add account
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
}

// Funciones globales para modales
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        
        // Preparar modal específico
        if (modalId === 'add-transaction-modal') {
            document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
            DataManager.updateCategoriesSelect();
        } else if (modalId === 'add-account-modal') {
            document.getElementById('account-balance').value = '0.00';
        }
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Limpiar formularios
    const forms = ['transaction-form', 'account-form', 'add-user-form', 'change-password-form'];
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) form.reset();
    });
}

// Inicialización principal
function initApp() {
    console.log('🚀 Inicializando FinPro Admin...');
    
    // Verificar autenticación
    if (AuthManager.checkAuth()) {
        console.log('✅ Usuario autenticado');
        AuthManager.showMainApp();
    } else {
        console.log('🔐 Mostrando login');
        AuthManager.showLoginView();
    }
    
    // Inicializar event handlers
    initEventHandlers();
    
    console.log('✅ Aplicación inicializada');
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
