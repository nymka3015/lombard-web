const CACHE_NAME = 'ogoozh-v3'; // Нэрийг нь v3 болгож солив

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('Service Worker v3 installed');
});

self.addEventListener('fetch', (event) => {
    // Вэб ажиллахад заавал байх ёстой хэсэг
});
