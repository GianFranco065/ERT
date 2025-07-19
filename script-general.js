// Variables globales
let currentData = [];
let filteredData = [];
let editingId = null;
let currentModule = 'maquinarias';

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar PWA
    await initializePWA();
    // Cargar datos (primero local, luego sincronizar)
    await cargarEstadisticasLocal();
    mostrarModulo('maquinarias');
});

// ========================================
// PWA INITIALIZATION
// ========================================
async function initializePWA() {
    try {
        // Inicializar IndexedDB
        await IndexedDBManager.init();
        
        // Inicializar gestión offline
        await OfflineManager.init();
        
        // Configurar eventos de conexión
        setupConnectionEvents();
        
        console.log('✅ PWA inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando PWA:', error);
    }
}

// Configurar eventos de conexión
function setupConnectionEvents() {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Verificar estado inicial
    if (navigator.onLine) {
        handleOnline();
    } else {
        handleOffline();
    }
}

// Manejar estado online
function handleOnline() {
    const statusEl = document.getElementById('connectionStatus');
    const syncBtn = document.getElementById('syncBtn');
    
    statusEl.style.display = 'none';
    syncBtn.style.display = 'inline-flex';
    
    // Auto-sincronizar cuando vuelve la conexión
    setTimeout(syncData, 1000);
}

// Manejar estado offline
function handleOffline() {
    const statusEl = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    const syncBtn = document.getElementById('syncBtn');
    
    statusText.textContent = 'Sin conexión - Trabajando offline';
    statusEl.style.display = 'flex';
    syncBtn.style.display = 'none';
}

// Sincronizar datos manualmente
async function syncData() {
    if (!navigator.onLine) {
        alert('Sin conexión a internet');
        return;
    }
    
    try {
        mostrarLoading();
        const syncBtn = document.getElementById('syncBtn');
        syncBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sincronizando...';
        
        // Sincronizar con OfflineManager
        await OfflineManager.syncAll();
        
        // Recargar datos después de sincronizar
        await cargarDatos(currentModule);
        await cargarEstadisticas();
        
        syncBtn.innerHTML = '<i class="fas fa-sync"></i> Sincronizar';
        alert('✅ Sincronización completada');
        
    } catch (error) {
        console.error('Error sincronizando:', error);
        alert('❌ Error en la sincronización');
    } finally {
        ocultarLoading();
    }
}

// ========================================
// FUNCIONES ORIGINALES CON PWA
// ========================================

// Función para mostrar loading
function mostrarLoading() {
    document.getElementById('loading').style.display = 'flex';
}

// Función para ocultar loading
function ocultarLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Función para mostrar el dashboard
function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('moduleView').style.display = 'none';
    cargarEstadisticas();
}

// Mostrar módulo (maneja ambos módulos) - MEJORADO CON PWA
function mostrarModulo(modulo) {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('moduleView').style.display = 'block';
    
    currentModule = modulo;
    
    if (modulo === 'maquinarias') {
        document.getElementById('moduleTitle').textContent = '🚜 Maquinarias';
    } else if (modulo === 'mantenimientos') {
        document.getElementById('moduleTitle').textContent = '🔧 Registros de Mantenimientos';
    }
    
    cargarDatos(modulo);
    configurarFiltros();
}

// Cargar datos (maneja ambos módulos) - MEJORADO CON PWA
async function cargarDatos(modulo) {
    try {
        mostrarLoading();
        let data = [];
        
        // Primero intentar cargar desde IndexedDB (offline)
        data = await IndexedDBManager.getAll(modulo);
        
        // Si hay conexión, sincronizar con servidor
        if (navigator.onLine) {
            try {
                let serverData;
                if (modulo === 'maquinarias') {
                    serverData = await callGoogleScript('obtenerMaquinarias');
                } else if (modulo === 'mantenimientos') {
                    serverData = await callGoogleScript('obtenerMantenimientos');
                }
                
                if (serverData && Array.isArray(serverData)) {
                    // Guardar en IndexedDB
                    await IndexedDBManager.syncData(modulo, serverData);
                    data = serverData;
                }
            } catch (error) {
                console.warn('Error conectando al servidor, usando datos locales:', error);
                // Continuar con datos locales
            }
        }
        
        currentData = data || [];
        filteredData = [...currentData];
        mostrarDatos(modulo);
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        alert('Error al cargar los datos. Verificando datos locales...');
        
        // Como último recurso, intentar datos locales
        try {
            const localData = await IndexedDBManager.getAll(modulo);
            currentData = localData || [];
            filteredData = [...currentData];
            mostrarDatos(modulo);
        } catch (localError) {
            console.error('Error cargando datos locales:', localError);
            currentData = [];
            filteredData = [];
            mostrarDatos(modulo);
        }
    } finally {
        ocultarLoading();
    }
}

// Mostrar datos en tabla (maneja ambos módulos)
function mostrarDatos(modulo) {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    
    let headers = [];
    let colspan = 0;
    
    if (modulo === 'maquinarias') {
        headers = ['Tipo', 'Nombre', 'Marca', 'Modelo', 'Año', 'Ubicación', 'Estado', 'Horómetro', 'Acciones'];
        colspan = 9;
    } else if (modulo === 'mantenimientos') {
        headers = ['N° Informe', 'Maquinarias', 'Tipo Mantenimiento', 'Fecha', 'Hora Inicio', 'Hora Término', 'Horómetro', 'Acciones'];
        colspan = 8;
    }
    
    tableHead.innerHTML = '<tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr>';
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="' + colspan + '" class="no-data">No hay registros disponibles</td></tr>';
        return;
    }
    
    let html = '';
    filteredData.forEach(function(item) {
        html += '<tr>';
        
        if (modulo === 'maquinarias') {
            html += '<td>' + (item.tipo_maquinaria || '') + '</td>';
            html += '<td><strong>' + (item.nombre || '') + '</strong></td>';
            html += '<td>' + (item.marca || '') + '</td>';
            html += '<td>' + (item.modelo || '') + '</td>';
            html += '<td>' + (item.año || '') + '</td>';
            html += '<td>' + (item.ubicacion || '') + '</td>';
            html += '<td><span class="status-badge status-' + (item.estado || '').toLowerCase() + '">' + (item.estado || '') + '</span></td>';
            html += '<td>' + (item.horometro_actual || '') + '</td>';
        } else if (modulo === 'mantenimientos') {
            html += '<td>' + (item.numero_informe || '') + '</td>';
            html += '<td><strong>' + (item.maquinarias || '') + '</strong></td>';
            html += '<td><span class="status-badge status-' + (item.tipo_mantenimiento || '').toLowerCase() + '">' + (item.tipo_mantenimiento || '') + '</span></td>';
            html += '<td>' + (item.fecha || '') + '</td>';
            html += '<td>' + (item.hora_inicio || '') + '</td>';
            html += '<td>' + (item.hora_termino || '') + '</td>';
            html += '<td>' + (item.horometro || '') + '</td>';
        }
        
        html += '<td>';
        html += '<button onclick="verRegistro(\'' + item.id + '\')" class="btn btn-info btn-xs" title="Ver detalles">';
        html += '<i class="fas fa-eye"></i>';
        html += '</button> ';
        html += '<button onclick="editarRegistro(\'' + item.id + '\')" class="btn btn-warning btn-xs" title="Editar">';
        html += '<i class="fas fa-edit"></i>';
        html += '</button> ';
        html += '<button onclick="eliminarRegistro(\'' + item.id + '\')" class="btn btn-danger btn-xs" title="Eliminar">';
        html += '<i class="fas fa-trash"></i>';
        html += '</button>';
        html += '</td>';
        html += '</tr>';
    });
    
    tableBody.innerHTML = html;
}

// Configurar filtros (maneja ambos módulos)
function configurarFiltros() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    
    statusFilter.innerHTML = '';
    
    if (currentModule === 'maquinarias') {
        statusFilter.innerHTML = `
            <option value="">Todos los estados</option>
            <option value="OPERATIVO">Operativo</option>
            <option value="INOPERATIVO">Inoperativo</option>
            <option value="STANDBY">Standby</option>
        `;
    } else if (currentModule === 'mantenimientos') {
        statusFilter.innerHTML = `
            <option value="">Todos los tipos</option>
            <option value="CORRECTIVO">Correctivo</option>
            <option value="PREVENTIVO">Preventivo</option>
            <option value="PREDICTIVO">Predictivo</option>
        `;
    }
    
    searchInput.removeEventListener('input', filtrarDatos);
    statusFilter.removeEventListener('change', filtrarDatos);
    
    searchInput.addEventListener('input', filtrarDatos);
    statusFilter.addEventListener('change', filtrarDatos);
}

// Filtrar datos (maneja ambos módulos)
function filtrarDatos() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredData = currentData.filter(function(item) {
        const matchesSearch = !searchTerm || 
            Object.values(item).some(function(value) {
                return value && value.toString().toLowerCase().includes(searchTerm);
            });
        
        let matchesStatus = true;
        if (statusFilter) {
            if (currentModule === 'maquinarias') {
                matchesStatus = item.estado === statusFilter;
            } else if (currentModule === 'mantenimientos') {
                matchesStatus = item.tipo_mantenimiento === statusFilter;
            }
        }
        
        return matchesSearch && matchesStatus;
    });
    
    mostrarDatos(currentModule);
}

// Función para filtrar por estado específico
function filtrarPorEstado(estado) {
    document.getElementById('statusFilter').value = estado;
    filtrarDatos();
    mostrarModulo('maquinarias');
}

// Nuevo registro (maneja ambos módulos)
function nuevoRegistro() {
    editingId = null;
    mostrarFormulario(currentModule);
}

// Editar registro (maneja ambos módulos)
function editarRegistro(id) {
    editingId = id;
    const registro = currentData.find(function(item) {
        return item.id === id;
    });
    mostrarFormulario(currentModule, registro);
}

// Ver registro completo (solo lectura)
function verRegistro(id) {
    const registro = currentData.find(function(item) {
        return item.id === id;
    });
    
    if (!registro) {
        alert('Registro no encontrado');
        return;
    }
    
    mostrarVistaCompleta(registro);
}

// Mostrar vista completa (maneja ambos módulos)
function mostrarVistaCompleta(datos) {
    const viewFields = document.getElementById('viewFields');
    const viewTitle = document.getElementById('viewModalTitle');
    
    let nombreRegistro = '';
    let campos = [];
    
    if (currentModule === 'maquinarias') {
        nombreRegistro = datos.nombre || 'Registro';
        campos = CAMPOS_MAQUINARIAS;
    } else if (currentModule === 'mantenimientos') {
        nombreRegistro = datos.numero_informe || datos.maquinarias || 'Registro';
        campos = CAMPOS_MANTENIMIENTOS;
    }
    
    viewTitle.textContent = 'Vista Completa - ' + nombreRegistro;
    
    let html = '';
    
    campos.forEach(function(campo) {
        const valor = datos[campo.nombre] || '';
        
        html += '<div class="view-group">';
        html += '<div class="view-label">' + campo.label.toUpperCase() + '</div>';
        html += '<div class="view-value">' + (valor || 'No especificado') + '</div>';
        html += '</div>';
    });
    
    viewFields.innerHTML = html;
    abrirModal('viewModal');
}

// Editar desde la vista completa
function editarDesdeVista() {
    const titulo = document.getElementById('viewModalTitle').textContent;
    const nombreRegistro = titulo.replace('Vista Completa - ', '');
    
    let registro;
    if (currentModule === 'maquinarias') {
        registro = currentData.find(function(item) {
            return item.nombre === nombreRegistro;
        });
    } else if (currentModule === 'mantenimientos') {
        registro = currentData.find(function(item) {
            return item.numero_informe === nombreRegistro || item.maquinarias === nombreRegistro;
        });
    }
    
    if (registro) {
        cerrarModal('viewModal');
        editarRegistro(registro.id);
    }
}

// Mostrar formulario (maneja ambos módulos)
function mostrarFormulario(modulo, datos) {
    datos = datos || null;
    const formFields = document.getElementById('formFields');
    const formTitle = document.getElementById('formModalTitle');
    
    formTitle.textContent = datos ? 'Editar Registro' : 'Nuevo Registro';
    
    let html = '';
    let campos = [];
    
    if (modulo === 'maquinarias') {
        campos = CAMPOS_MAQUINARIAS;
    } else if (modulo === 'mantenimientos') {
        campos = CAMPOS_MANTENIMIENTOS;
    }
    
    campos.forEach(function(campo) {
        const valor = datos ? (datos[campo.nombre] || '') : '';
        
        html += '<div class="form-group">';
        html += '<label class="form-label">' + campo.label + (campo.obligatorio ? ' *' : '') + '</label>';
        
        if (campo.tipo === 'texto' || campo.tipo === 'numero' || campo.tipo === 'decimal') {
            html += '<input type="' + (campo.tipo === 'numero' || campo.tipo === 'decimal' ? 'number' : 'text') + '" ';
            html += 'id="' + campo.nombre + '" ';
            html += 'name="' + campo.nombre + '" ';
            html += 'class="form-input" ';
            html += 'value="' + valor + '"';
            if (campo.obligatorio) html += ' required';
            if (campo.tipo === 'decimal') html += ' step="0.01"';
            if (campo.maxLength) html += ' maxlength="' + campo.maxLength + '"';
            html += '>';
        } else if (campo.tipo === 'fecha') {
            html += '<input type="date" ';
            html += 'id="' + campo.nombre + '" ';
            html += 'name="' + campo.nombre + '" ';
            html += 'class="form-input" ';
            html += 'value="' + valor + '"';
            if (campo.obligatorio) html += ' required';
            html += '>';
        } else if (campo.tipo === 'hora') {
            html += '<input type="time" ';
            html += 'id="' + campo.nombre + '" ';
            html += 'name="' + campo.nombre + '" ';
            html += 'class="form-input" ';
            html += 'value="' + valor + '"';
            if (campo.obligatorio) html += ' required';
            html += '>';
        } else if (campo.tipo === 'select') {
            html += '<select id="' + campo.nombre + '" name="' + campo.nombre + '" class="form-select"';
            if (campo.obligatorio) html += ' required';
            html += '>';
            html += '<option value="">Seleccionar...</option>';
            campo.opciones.forEach(function(opcion) {
                html += '<option value="' + opcion + '"' + (valor === opcion ? ' selected' : '') + '>' + opcion + '</option>';
            });
            html += '</select>';
        } else if (campo.tipo === 'multiple_texto') {
            html += '<textarea id="' + campo.nombre + '" ';
            html += 'name="' + campo.nombre + '" ';
            html += 'class="form-textarea" ';
            html += 'rows="4" ';
            html += 'placeholder="Ingrese cada línea por separado"';
            if (campo.obligatorio) html += ' required';
            html += '>' + valor + '</textarea>';
        }
        
        html += '</div>';
    });
    
    formFields.innerHTML = html;
    abrirModal('formModal');
}

// Guardar formulario (maneja ambos módulos) - MEJORADO CON PWA
async function guardarFormulario() {
    try {
        const form = document.getElementById('dynamicForm');
        const formData = new FormData(form);
        const datos = {};
        
        for (let pair of formData.entries()) {
            datos[pair[0]] = pair[1];
        }
        
        if (editingId) {
            datos.id = editingId;
        }
        
        const errores = [];
        let campos = [];
        
        if (currentModule === 'maquinarias') {
            campos = CAMPOS_MAQUINARIAS;
        } else if (currentModule === 'mantenimientos') {
            campos = CAMPOS_MANTENIMIENTOS;
        }
        
        campos.forEach(function(campo) {
            if (campo.obligatorio && (!datos[campo.nombre] || datos[campo.nombre].trim() === '')) {
                errores.push(campo.label);
            }
        });
        
        if (errores.length > 0) {
            alert('Los siguientes campos son obligatorios: ' + errores.join(', '));
            return;
        }
        
        mostrarLoading();
        
        // Guardar primero en IndexedDB (offline-first)
        await IndexedDBManager.save(currentModule, datos);
        
        // Si hay conexión, intentar guardar en servidor
        if (navigator.onLine) {
            try {
                let response;
                if (currentModule === 'maquinarias') {
                    response = await callGoogleScript('guardarMaquinaria', datos);
                } else if (currentModule === 'mantenimientos') {
                    response = await callGoogleScript('guardarMantenimiento', datos);
                }
                
                if (response.success) {
                    alert('✅ ' + response.message);
                } else {
                    // Agregar a cola de sincronización
                    await OfflineManager.addToSyncQueue(editingId ? 'UPDATE' : 'CREATE', currentModule, datos);
                    alert('⚠️ Guardado localmente. Se sincronizará cuando haya conexión.');
                }
            } catch (error) {
                // Agregar a cola de sincronización
                await OfflineManager.addToSyncQueue(editingId ? 'UPDATE' : 'CREATE', currentModule, datos);
                alert('⚠️ Sin conexión. Guardado localmente, se sincronizará automáticamente.');
            }
        } else {
            // Agregar a cola de sincronización
            await OfflineManager.addToSyncQueue(editingId ? 'UPDATE' : 'CREATE', currentModule, datos);
            alert('💾 Guardado offline. Se sincronizará cuando haya conexión.');
        }
        
        cerrarModal('formModal');
        await cargarDatos(currentModule);
        await cargarEstadisticas();
        
    } catch (error) {
        console.error('Error guardando:', error);
        alert('❌ Error al guardar el registro.');
    } finally {
        ocultarLoading();
    }
}

// Eliminar registro (maneja ambos módulos) - MEJORADO CON PWA
async function eliminarRegistro(id) {
    if (!confirm('¿Está seguro de que desea eliminar este registro?')) {
        return;
    }
    
    try {
        mostrarLoading();
        
        // Eliminar de IndexedDB primero
        await IndexedDBManager.delete(currentModule, id);
        
        // Si hay conexión, intentar eliminar del servidor
        if (navigator.onLine) {
            try {
                let response;
                if (currentModule === 'maquinarias') {
                    response = await callGoogleScript('eliminarMaquinaria', id);
                } else if (currentModule === 'mantenimientos') {
                    response = await callGoogleScript('eliminarMantenimiento', id);
                }
                
                if (response.success) {
                    alert('✅ ' + response.message);
                } else {
                    // Agregar a cola de sincronización
                    await OfflineManager.addToSyncQueue('DELETE', currentModule, { id: id });
                    alert('⚠️ Eliminado localmente. Se sincronizará cuando haya conexión.');
                }
            } catch (error) {
                // Agregar a cola de sincronización
                await OfflineManager.addToSyncQueue('DELETE', currentModule, { id: id });
                alert('⚠️ Sin conexión. Eliminado localmente, se sincronizará automáticamente.');
            }
        } else {
            // Agregar a cola de sincronización
            await OfflineManager.addToSyncQueue('DELETE', currentModule, { id: id });
            alert('💾 Eliminado offline. Se sincronizará cuando haya conexión.');
        }
        
        await cargarDatos(currentModule);
        await cargarEstadisticas();
        
    } catch (error) {
        console.error('Error eliminando:', error);
        alert('❌ Error al eliminar el registro.');
    } finally {
        ocultarLoading();
    }
}

// Cargar estadísticas - MEJORADO CON PWA
async function cargarEstadisticas() {
    try {
        let stats;
        
        // Primero intentar desde IndexedDB
        const localMaquinarias = await IndexedDBManager.getAll('maquinarias');
        if (localMaquinarias && localMaquinarias.length > 0) {
            stats = {
                total: localMaquinarias.length,
                operativas: localMaquinarias.filter(m => m.estado === 'OPERATIVO').length,
                inoperativas: localMaquinarias.filter(m => m.estado === 'INOPERATIVO').length,
                standby: localMaquinarias.filter(m => m.estado === 'STANDBY').length
            };
        }
        
        // Si hay conexión, obtener del servidor
        if (navigator.onLine) {
            try {
                const serverStats = await callGoogleScript('obtenerEstadisticasMaquinarias');
                if (serverStats) {
                    stats = serverStats;
                }
            } catch (error) {
                console.warn('Error obteniendo estadísticas del servidor, usando locales');
            }
        }
        
        // Actualizar UI
        if (stats) {
            document.getElementById('totalCount').textContent = stats.total || 0;
            document.getElementById('operativasCount').textContent = stats.operativas || 0;
            document.getElementById('inoperativasCount').textContent = stats.inoperativas || 0;
            document.getElementById('standbyCount').textContent = stats.standby || 0;
        }
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        // Valores por defecto
        document.getElementById('totalCount').textContent = 0;
        document.getElementById('operativasCount').textContent = 0;
        document.getElementById('inoperativasCount').textContent = 0;
        document.getElementById('standbyCount').textContent = 0;
    }
}

// Cargar estadísticas locales (para inicio rápido)
async function cargarEstadisticasLocal() {
    try {
        const localMaquinarias = await IndexedDBManager.getAll('maquinarias');
        if (localMaquinarias && localMaquinarias.length > 0) {
            const stats = {
                total: localMaquinarias.length,
                operativas: localMaquinarias.filter(m => m.estado === 'OPERATIVO').length,
                inoperativas: localMaquinarias.filter(m => m.estado === 'INOPERATIVO').length,
                standby: localMaquinarias.filter(m => m.estado === 'STANDBY').length
            };
            
            document.getElementById('totalCount').textContent = stats.total;
            document.getElementById('operativasCount').textContent = stats.operativas;
            document.getElementById('inoperativasCount').textContent = stats.inoperativas;
            document.getElementById('standbyCount').textContent = stats.standby;
        }
    } catch (error) {
        console.warn('No hay datos locales disponibles');
    }
}

// Función para abrir modal
function abrirModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

// Función para cerrar modal
function cerrarModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    editingId = null;
}

// Cerrar modal al hacer clic fuera de él
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let i = 0; i < modals.length; i++) {
        const modal = modals[i];
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
};