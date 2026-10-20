/* Justo · modo sin conexión.
 * Estrategia: primero la red (para que una actualización se vea en cuanto se publica) y,
 * si no hay conexión o la señal es tan mala que tarda más de 3 segundos, la última copia guardada.
 * Solo guarda archivos de Justo; no toca nada de otros sitios y no guarda lo que escribe la persona
 * (eso vive en localStorage). Para forzar que todos recarguen archivos nuevos, cambia VERSION. */

var VERSION = 'justo-v2-6';
var SLOW_MS = 3000;          // cuánto esperar a la red antes de usar la copia guardada
var SLOW_MODE_MS = 60000;    // tras una espera larga, el resto de archivos sale de la copia sin esperar
var slowUntil = 0;
var CORE = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'config.js',
  'data/es.json',
  'data/en.json',
  'data/pt.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // Un archivo que falle no debe impedir que el resto quede guardado.
      return Promise.all(CORE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { /* se guardará cuando se visite */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names
        .filter(function (n) { return n.indexOf('justo') === 0 && n !== VERSION; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    if (req.mode === 'navigate') return caches.match('index.html');
    return null;
  });
}

function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    function done(res) { if (!settled) { settled = true; resolve(res); } }

    // Señal muy lenta: si ya hay copia guardada, úsala sin esperar más. Al detectar una red lenta,
    // los demás archivos de esta visita no repiten la espera (si no, 3 s se vuelven 9 s en cadena).
    var timer = setTimeout(function () {
      fromCache(req).then(function (hit) {
        if (hit) { slowUntil = Date.now() + SLOW_MODE_MS; done(hit); }
      });
    }, Date.now() < slowUntil ? 0 : SLOW_MS);

    fetch(req, { cache: 'no-cache' }).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(VERSION).then(function (cache) { cache.put(req, copy); }).catch(function () {});
      }
      done(res);
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (hit) {
        done(hit || new Response('', { status: 504, statusText: 'Sin conexión' }));
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});
