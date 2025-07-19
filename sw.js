// Service Worker para PWA - Sistema de Gestión de Maquinarias
const CACHE_NAME = 'maquinarias-pwa-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/script-general.js',
  '/script-maquinarias.js',
  '/script-mantenimientos.js',
  '/indexeddb-manager.js',
  '/offline-manager.js',
  '/manifest.json',
  '/icon-16x16.png',
  '/icon-32x32.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache abierto');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Archivos cacheados correctamente');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Error cacheando archivos:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado');
      return self.clients.claim();
    })
  );
});

// Interceptar peticiones de red
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Estrategia: Cache First para archivos estáticos
  if (CACHE_URLS.some(cacheUrl => request.url.includes(cacheUrl)) || 
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'image') {
    
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            console.log('📦 Servido desde cache:', request.url);
            return response;
          }
          
          return fetch(request)
            .then(response => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, responseToCache);
                });
              
              console.log('🌐 Descargado y cacheado:', request.url);
              return response;
            })
            .catch(() => {
              console.log('⚠️ Sin conexión, sirviendo desde cache:', request.url);
              return caches.match('/');
            });
        })
    );
  }
  
  // Estrategia: Network First para API calls
  else if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          console.log('🌐 API call exitosa:', request.url);
          return response;
        })
        .catch(error => {
          console.log('❌ API call falló, trabajando offline:', error);
          // Retornar respuesta offline si es necesario
          return new Response(
            JSON.stringify({ success: false, message: 'Sin conexión, trabajando offline' }),
            {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
  }
});

// Manejar sincronización en segundo plano
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Ejecutando sincronización en segundo plano');
    event.waitUntil(doBackgroundSync());
  }
});

// Función de sincronización en segundo plano
async function doBackgroundSync() {
  try {
    // Notificar a la aplicación que ejecute la sincronización
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        message: 'Ejecutando sincronización automática'
      });
    });
  } catch (error) {
    console.error('Error en sincronización:', error);
  }
}

// Manejar notificaciones push (para futuro)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-32x32.png',
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'open',
          title: 'Abrir App'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          clients.openWindow('/');
        }
      })
    );
  }
});