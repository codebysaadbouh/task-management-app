'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Listen for online event and notify SW to replay pending actions
      const handleOnline = async () => {
        // Fallback: post message to SW
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'ONLINE' });
        }

        // Background Sync API (if supported)
        if ('sync' in registration) {
          try {
            await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register('sync-pending-actions');
          } catch {
            // Background Sync not available, message fallback already sent
          }
        }
      };

      window.addEventListener('online', handleOnline);

      return () => {
        window.removeEventListener('online', handleOnline);
      };
    }).catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
  }, []);

  return null;
}
