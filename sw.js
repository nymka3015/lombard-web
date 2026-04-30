const CACHE_NAME = 'ogoozh-v6';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('V6 суулгагдлаа');
});

self.addEventListener('activate', (event) => {
    console.log('V6 идэвхжлээ');
});

// Энэ хэсэг заавал байх ёстой, хоосон байсан ч хамаагүй!
self.addEventListener('fetch', (event) => {
    // Вэб ажиллаж байх үед өгөгдөл дамжуулахыг хянана
});
