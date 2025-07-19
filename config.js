// Configuración de la API - Solución definitiva para CORS
const API_CONFIG = {
    url: 'https://script.google.com/macros/s/AKfycbx8Y_2etRClc9ldoSSO6bozNkMWcW1NG3ZKhrxqfk1oYDg6oDc7uirqQCrwRvVoCPFN/exec'
};

// Función para hacer peticiones usando JSONP (evita CORS completamente)
function callGoogleScript(action, data = null) {
    return new Promise((resolve, reject) => {
        try {
            // Crear un callback único
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            
            // Crear el script tag
            const script = document.createElement('script');
            
            // Configurar el callback global
            window[callbackName] = function(response) {
                // Limpiar
                document.head.removeChild(script);
                delete window[callbackName];
                
                // Resolver la promesa
                resolve(response);
            };
            
            // Preparar los parámetros
            const params = new URLSearchParams({
                action: action,
                callback: callbackName
            });
            
            if (data) {
                params.append('data', JSON.stringify(data));
            }
            
            // Configurar la URL del script
            script.src = `${API_CONFIG.url}?${params.toString()}`;
            
            // Manejar errores
            script.onerror = function() {
                document.head.removeChild(script);
                delete window[callbackName];
                reject(new Error('Error al cargar el script'));
            };
            
            // Agregar el script al DOM
            document.head.appendChild(script);
            
        } catch (error) {
            reject(error);
        }
    });
}