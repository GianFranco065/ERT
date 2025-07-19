// IndexedDB Manager para PWA - Sistema de Gestión de Maquinarias

class IndexedDBManager {
    static dbName = 'MachineryDB';
    static version = 1;
    static db = null;

    // Inicializar IndexedDB
    static async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ Error abriendo IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB inicializada correctamente');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔧 Actualizando estructura de IndexedDB...');

                // Store para maquinarias
                if (!db.objectStoreNames.contains('maquinarias')) {
                    const maquinariasStore = db.createObjectStore('maquinarias', { keyPath: 'id' });
                    maquinariasStore.createIndex('estado', 'estado', { unique: false });
                    maquinariasStore.createIndex('nombre', 'nombre', { unique: false });
                    maquinariasStore.createIndex('tipo_maquinaria', 'tipo_maquinaria', { unique: false });
                    console.log('📦 Store "maquinarias" creado');
                }

                // Store para mantenimientos
                if (!db.objectStoreNames.contains('mantenimientos')) {
                    const mantenimientosStore = db.createObjectStore('mantenimientos', { keyPath: 'id' });
                    mantenimientosStore.createIndex('tipo_mantenimiento', 'tipo_mantenimiento', { unique: false });
                    mantenimientosStore.createIndex('maquinarias', 'maquinarias', { unique: false });
                    mantenimientosStore.createIndex('fecha', 'fecha', { unique: false });
                    console.log('📦 Store "mantenimientos" creado');
                }

                // Store para cola de sincronización
                if (!db.objectStoreNames.contains('sync_queue')) {
                    const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
                    syncStore.createIndex('action', 'action', { unique: false });
                    syncStore.createIndex('table', 'table', { unique: false });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('📦 Store "sync_queue" creado');
                }
            };
        });
    }

    // Obtener todos los registros de una tabla
    static async getAll(tableName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB no inicializada'));
                return;
            }

            const transaction = this.db.transaction([tableName], 'readonly');
            const store = transaction.objectStore(tableName);
            const request = store.getAll();

            request.onsuccess = () => {
                const data = request.result || [];
                console.log(`📦 Obtenidos ${data.length} registros de ${tableName}`);
                resolve(data);
            };

            request.onerror = () => {
                console.error(`❌ Error obteniendo datos de ${tableName}:`, request.error);
                reject(request.error);
            };
        });
    }

    // Obtener un registro por ID
    static async getById(tableName, id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB no inicializada'));
                return;
            }

            const transaction = this.db.transaction([tableName], 'readonly');
            const store = transaction.objectStore(tableName);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Guardar un registro
    static async save(tableName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB no inicializada'));
                return;
            }

            // Generar ID si no existe
            if (!data.id) {
                data.id = this.generateUUID();
            }

            // Agregar timestamps
            const now = new Date().toISOString();
            if (!data.fecha_creacion) {
                data.fecha_creacion = now;
            }
            data.fecha_modificacion = now;
            data.is_synced = false;

            const transaction = this.db.transaction([tableName], 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.put(data);

            request.onsuccess = () => {
                console.log(`💾 Guardado en ${tableName}:`, data.id);
                resolve(data);
            };

            request.onerror = () => {
                console.error(`❌ Error guardando en ${tableName}:`, request.error);
                reject(request.error);
            };
        });
    }

    // Eliminar un registro
    static async delete(tableName, id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB no inicializada'));
                return;
            }

            const transaction = this.db.transaction([tableName], 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`🗑️ Eliminado de ${tableName}:`, id);
                resolve(true);
            };

            request.onerror = () => {
                console.error(`❌ Error eliminando de ${tableName}:`, request.error);
                reject(request.error);
            };
        });
    }

    // Sincronizar datos del servidor
    static async syncData(tableName, serverData) {
        if (!Array.isArray(serverData)) {
            console.warn('Datos del servidor no son un array');
            return;
        }

        try {
            // Limpiar datos existentes
            await this.clearTable(tableName);

            // Insertar datos del servidor
            for (const item of serverData) {
                item.is_synced = true;
                item.last_sync = new Date().toISOString();
                await this.save(tableName, item);
            }

            console.log(`🔄 Sincronizados ${serverData.length} registros en ${tableName}`);
        } catch (error) {
            console.error(`❌ Error sincronizando ${tableName}:`, error);
            throw error;
        }
    }

    // Limpiar una tabla
    static async clearTable(tableName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB no inicializada'));
                return;
            }

            const transaction = this.db.transaction([tableName], 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log(`🧹 Tabla ${tableName} limpiada`);
                resolve(true);
            };

            request.onerror = () => {
                console.error(`❌ Error limpiando ${tableName}:`, request.error);
                reject(request.error);
            };
        });
    }

    // Obtener registros no sincronizados
    static async getUnsyncedRecords(tableName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB no inicializada'));
                return;
            }

            const transaction = this.db.transaction([tableName], 'readonly');
            const store = transaction.objectStore(tableName);
            const request = store.getAll();

            request.onsuccess = () => {
                const allRecords = request.result || [];
                const unsyncedRecords = allRecords.filter(record => !record.is_synced);
                console.log(`📤 ${unsyncedRecords.length} registros sin sincronizar en ${tableName}`);
                resolve(unsyncedRecords);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Marcar registro como sincronizado
    static async markAsSynced(tableName, id) {
        try {
            const record = await this.getById(tableName, id);
            if (record) {
                record.is_synced = true;
                record.last_sync = new Date().toISOString();
                await this.save(tableName, record);
                console.log(`✅ Registro marcado como sincronizado: ${id}`);
            }
        } catch (error) {
            console.error('Error marcando como sincronizado:', error);
        }
    }

    // Generar UUID
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Obtener estadísticas de almacenamiento
    static async getStorageInfo() {
        try {
            const maquinarias = await this.getAll('maquinarias');
            const mantenimientos = await this.getAll('mantenimientos');
            const syncQueue = await this.getAll('sync_queue');

            return {
                maquinarias: maquinarias.length,
                mantenimientos: mantenimientos.length,
                pendingSync: syncQueue.length,
                totalRecords: maquinarias.length + mantenimientos.length
            };
        } catch (error) {
            console.error('Error obteniendo info de almacenamiento:', error);
            return {
                maquinarias: 0,
                mantenimientos: 0,
                pendingSync: 0,
                totalRecords: 0
            };
        }
    }
}

// Exportar para uso global
window.IndexedDBManager = IndexedDBManager;