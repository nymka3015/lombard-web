// v2 - Хувилбарыг өөрчлөх нь хөтөчийг шинэчлэлт хийхэд хүргэдэг
self.addEventListener('install', (e) => {
  self.skipWaiting(); 
  console.log('Service Worker v2 installed');
});

self.addEventListener('fetch', (e) => {
  // Хоосон байж болно
});
