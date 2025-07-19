// Configuración de campos para Registros de Mantenimientos
const CAMPOS_MANTENIMIENTOS = [
    { nombre: 'numero_informe', tipo: 'numero', obligatorio: false, label: 'N° Informe', maxLength: 6 },
    { nombre: 'maquinarias', tipo: 'texto', obligatorio: false, label: 'Maquinarias' },
    { nombre: 'personal_asignado', tipo: 'multiple_texto', obligatorio: false, label: 'Personal Asignado' },
    { nombre: 'fallas_encontradas', tipo: 'multiple_texto', obligatorio: false, label: 'Fallas Encontradas' },
    { nombre: 'trabajos_realizados', tipo: 'multiple_texto', obligatorio: false, label: 'Trabajos Realizados' },
    { nombre: 'tipo_mantenimiento', tipo: 'select', obligatorio: false, label: 'Tipo de Mantenimiento',
      opciones: ['CORRECTIVO', 'PREVENTIVO', 'PREDICTIVO'] },
    { nombre: 'fecha', tipo: 'fecha', obligatorio: false, label: 'Fecha' },
    { nombre: 'hora_inicio', tipo: 'hora', obligatorio: false, label: 'Hora de Inicio' },
    { nombre: 'hora_termino', tipo: 'hora', obligatorio: false, label: 'Hora de Término' },
    { nombre: 'horometro', tipo: 'decimal', obligatorio: false, label: 'Horómetro' },
    { nombre: 'observaciones', tipo: 'multiple_texto', obligatorio: false, label: 'Observaciones' }
];