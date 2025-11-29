// Configuración de la aplicación - ACTUALIZA CON TU NUEVA URL
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbyfGbp-r64fRN_rr-Pwls_7Y-4CpQfy7H62pUG31m2LWn2IOalcRcFK_Ut55Pwlbom-/exec', // ← ACTUALIZA ESTO!
    APP_NAME: 'FinPro',
    VERSION: '1.0.3'
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
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
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

// Servicio de API - MEJORADO CON DIAGNÓSTICO DE CONEXIÓN
const ApiService = {
    async request(action, data = {}) {
        try {
            console.log(`📡 Enviando solicitud a API: ${action}`, data);
            
            // Verificar conexión a internet
            if (!navigator.onLine) {
                throw new Error('🔌 No hay conexión a internet. Verifica tu conexión.');
            }
            
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

    // Función para probar conexión
    async testConnection() {
        try {
            console.log('🧪 Probando conexión con API...');
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'test-connection',
                    data: {}
                })
            });
            
            const result = await response.json();
            return result.success ? '✅ Conexión exitosa' : '❌ Error: ' + result.error;
        } catch (error) {
            return '❌ Error de conexión: ' + error.message;
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

// El resto del código de app.js se mantiene IGUAL...
// [TODO EL CÓDIGO RESTANTE DE app.js QUE YA TENÍAS]

// Gestión de Autenticación
const AuthManager = {
    // Verificar si
