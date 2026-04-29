self.addEventListener('install', (e) => {
  console.log('Service Worker installed');
});

self.addEventListener('fetch', (e) => {
  // Энэ нь вэбийг офлайн үед ажиллахад тусалдаг, одоохондоо хоосон байж болно
});
