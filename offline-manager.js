// Offline Manager para PWA - Sistema de Gestión de Maquinarias

class OfflineManager {
    static isOnline = navigator.onLine;
    static syncInProgress = false;

    // Inicializar gestor offline
    static async init() {
        console.log('🌐 Inicializando Offline Manager...');
        
        // Configurar eventos de conexión
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Verificar estado inicial
        this.isOnline = navigator.onLine;
        console.log(`📡 Estado de conexión inicial: ${this.isOnline ? 'Online' : 'Offline'}`);
        
        // Si está online, intentar sincronizar
        if (this.isOnline) {
            setTimeout(() => this.syncAll(), 2000);
        }
    }

    // Manejar evento online
    static handleOnline() {
        console.log('🌐 Conexión restaurada');
        this.isOnline = true;
        
        // Notificar a la UI
        this.updateConnectionStatus(true);
        
        // Auto-sincronizar después de un breve retraso
        setTimeout(() => this.syncAll(), 1000);
    }

    // Manejar evento offline
    static handleOffline() {
        console.log('📵 Conexión perdida');
        this.isOnline = false;
        
        // Notificar a la UI
        this.updateConnectionStatus(false);
    }

    // Actualizar estado de conexión en la UI
    static updateConnectionStatus(isOnline) {
        const statusEl = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        const syncBtn = document.getElementById('syncBtn');

        if (isOnline) {
            statusEl.style.display = 'none';
            if (syncBtn) syncBtn.style.display = 'inline-flex';
        } else {
            if (statusText) statusText.textContent = 'Sin conexión - Trabajando offline';
            statusEl.style.display = 'flex';
            if (syncBtn) syncBtn.style.display = 'none';
        }
    }

    // Agregar acción a la cola de sincronización
    static async addToSyncQueue(action, table, data) {
        const syncItem = {
            id: this.generateSyncId(),
            action: action, // CREATE, UPDATE, DELETE
            table: table,   // maquinarias, mantenimientos
            data: data,
            timestamp: new Date().toISOString(),
            synced: false,
            retry_count: 0,
            error_message: null
        };

        try {
            await IndexedDBManager.save('sync_queue', syncItem);
            console.log(`📤 Agregado a cola de sincronización: ${action} ${table}`);
        } catch (error) {
            console.error('Error agregando a cola de sync:', error);
        }
    }

    // Sincronizar todos los datos pendientes
    static async syncAll() {
        if (this.syncInProgress || !this.isOnline) {
            console.log('⏳ Sincronización en progreso o sin conexión');
            return;
        }

        console.log('🔄 Iniciando sincronización completa...');
        this.syncInProgress = true;

        try {
            // Obtener cola de sincronización
            const syncQueue = await IndexedDBManager.getAll('sync_queue');
            const pendingItems = syncQueue.filter(item => !item.synced);

            console.log(`📋 ${pendingItems.length} elementos en cola de sincronización`);

            // Procesar cada elemento
            for (const item of pendingItems) {
                await this.processSyncItem(item);
            }

            // Sincronizar datos del servidor
            await this.syncFromServer();

            console.log('✅ Sincronización completa finalizada');

        } catch (error) {
            console.error('❌ Error en sincronización:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    // Procesar un elemento de la cola de sincronización
    static async processSyncItem(item) {
        try {
            let response;
            const maxRetries = 3;

            // Intentar sincronizar con el servidor
            if (item.action === 'CREATE' || item.action === 'UPDATE') {
                if (item.table === 'maquinarias') {
                    response = await callGoogleScript('guardarMaquinaria', item.data);
                } else if (item.table === 'mantenimientos') {
                    response = await callGoogleScript('guardarMantenimiento', item.data);
                }
            } else if (item.action === 'DELETE') {
                if (item.table === 'maquinarias') {
                    response = await callGoogleScript('eliminarMaquinaria', item.data.id);
                } else if (item.table === 'mantenimientos') {
                    response = await callGoogleScript('eliminarMantenimiento', item.data.id);
                }
            }

            if (response && response.success) {
                // Marcar como sincronizado
                item.synced = true;
                item.error_message = null;
                await IndexedDBManager.save('sync_queue', item);

                // Marcar el registro original como sincronizado
                if (item.action !== 'DELETE') {
                    await IndexedDBManager.markAsSynced(item.table, item.data.id);
                }

                console.log(`✅ Sincronizado: ${item.action} ${item.table} ${item.data.id || 'N/A'}`);

            } else {
                // Incrementar contador de reintentos
                item.retry_count = (item.retry_count || 0) + 1;
                item.error_message = response ? response.message : 'Error desconocido';

                if (item.retry_count >= maxRetries) {
                    console.error(`❌ Falló después de ${maxRetries} intentos: ${item.action} ${item.table}`);
                } else {
                    console.warn(`⚠️ Reintento ${item.retry_count}/${maxRetries}: ${item.action} ${item.table}`);
                }

                await IndexedDBManager.save('sync_queue', item);
            }

        } catch (error) {
            console.error(`❌ Error procesando sync item:`, error);
            
            // Actualizar error en la cola
            item.retry_count = (item.retry_count || 0) + 1;
            item.error_message = error.message;
            await IndexedDBManager.save('sync_queue', item);
        }
    }

    // Sincronizar datos desde el servidor
    static async syncFromServer() {
        try {
            console.log('📥 Sincronizando datos del servidor...');

            // Obtener maquinarias del servidor
            const maquinarias = await callGoogleScript('obtenerMaquinarias');
            if (maquinarias && Array.isArray(maquinarias)) {
                await IndexedDBManager.syncData('maquinarias', maquinarias);
            }

            // Obtener mantenimientos del servidor
            const mantenimientos = await callGoogleScript('obtenerMantenimientos');
            if (mantenimientos && Array.isArray(mantenimientos)) {
                await IndexedDBManager.syncData('mantenimientos', mantenimientos);
            }

            console.log('📥 Datos del servidor sincronizados');

        } catch (error) {
            console.warn('⚠️ No se pudieron obtener datos del servidor:', error);
        }
    }

    // Limpiar elementos sincronizados de la cola
    static async cleanSyncQueue() {
        try {
            const syncQueue = await IndexedDBManager.getAll('sync_queue');
            const syncedItems = syncQueue.filter(item => item.synced);

            for (const item of syncedItems) {
                await IndexedDBManager.delete('sync_queue', item.id);
            }

            console.log(`🧹 ${syncedItems.length} elementos sincronizados eliminados de la cola`);

        } catch (error) {
            console.error('Error limpiando cola de sync:', error);
        }
    }

    // Obtener estadísticas de sincronización
    static async getSyncStats() {
        try {
            const syncQueue = await IndexedDBManager.getAll('sync_queue');
            const pending = syncQueue.filter(item => !item.synced);
            const failed = syncQueue.filter(item => item.retry_count >= 3);

            return {
                total: syncQueue.length,
                pending: pending.length,
                failed: failed.length,
                synced: syncQueue.length - pending.length
            };
        } catch (error) {
            console.error('Error obteniendo stats de sync:', error);
            return { total: 0, pending: 0, failed: 0, synced: 0 };
        }
    }

    // Generar ID único para sincronización
    static generateSyncId() {
        return 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Forzar sincronización de un registro específico
    static async forceSyncRecord(table, recordId) {
        try {
            const record = await IndexedDBManager.getById(table, recordId);
            if (record) {
                await this.addToSyncQueue('UPDATE', table, record);
                await this.syncAll();
                console.log(`🔄 Sincronización forzada para ${table}:${recordId}`);
            }
        } catch (error) {
            console.error('Error en sincronización forzada:', error);
        }
    }
}

// Service Worker message handler
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'BACKGROUND_SYNC') {
            console.log('📨 Mensaje del Service Worker:', event.data.message);
            OfflineManager.syncAll();
        }
    });
}

// Exportar para uso global
window.OfflineManager = OfflineManager;