// Configuración de campos para Maquinarias
const CAMPOS_MAQUINARIAS = [
    { nombre: 'tipo_maquinaria', tipo: 'texto', obligatorio: true, label: 'Tipo de Maquinaria' },
    { nombre: 'nombre', tipo: 'texto', obligatorio: true, label: 'Nombre' },
    { nombre: 'marca', tipo: 'texto', obligatorio: true, label: 'Marca' },
    { nombre: 'modelo', tipo: 'texto', obligatorio: true, label: 'Modelo' },
    { nombre: 'serie', tipo: 'texto', obligatorio: false, label: 'Serie' },
    { nombre: 'año', tipo: 'numero', obligatorio: true, label: 'Año de Fabricación' },
    { nombre: 'ubicacion', tipo: 'texto', obligatorio: true, label: 'Ubicación Actual' },
    { nombre: 'estado', tipo: 'select', obligatorio: true, label: 'Estado',
      opciones: ['OPERATIVO', 'INOPERATIVO', 'STANDBY'] },
    { nombre: 'horometro_actual', tipo: 'decimal', obligatorio: false, label: 'Horómetro Actual' },
    { nombre: 'observaciones', tipo: 'multiple_texto', obligatorio: false, label: 'Observaciones' }
];

// Función para cargar estadísticas de maquinarias
async function cargarEstadisticas() {
    try {
        const stats = await callGoogleScript('obtenerEstadisticasMaquinarias');
        document.getElementById('totalCount').textContent = stats.total || 0;
        document.getElementById('operativasCount').textContent = stats.operativas || 0;
        document.getElementById('inoperativasCount').textContent = stats.inoperativas || 0;
        document.getElementById('standbyCount').textContent = stats.standby || 0;
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}