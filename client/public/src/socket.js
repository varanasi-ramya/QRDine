/**
 * client/public/src/socket.js
 * Socket.IO client setup for the QRDine Student Self-Order App.
 * Connects to the backend server and manages order room sessions.
 */

export function getServerUrl() {
  if (typeof window !== 'undefined') {
    if (window.QRDINE_SERVER_URL) return window.QRDINE_SERVER_URL;
    try {
      const stored = localStorage.getItem('QRDINE_SERVER_URL');
      if (stored) return stored;
    } catch (_) {}

    if (window.location && window.location.hostname) {
      const host = window.location.hostname;
      // When testing on a mobile device or LAN IP (e.g. 192.168.1.15)
      if (host !== 'localhost' && host !== '127.0.0.1') {
        const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${proto}//${host}:3000`;
      }
    }
  }
  return 'http://localhost:3000';
}

const SERVER_URL = getServerUrl();

// Safe initialization of Socket.IO
function createSocket() {
  if (typeof window !== 'undefined' && typeof window.io === 'function') {
    return window.io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling']
    });
  }

  console.warn('[Socket] window.io is not loaded yet. Creating mock/deferred socket.');
  // Return a safe placeholder that will forward listeners once io is ready
  const pendingListeners = [];
  const placeholder = {
    connected: false,
    on(event, handler) {
      pendingListeners.push({ action: 'on', event, handler });
    },
    once(event, handler) {
      pendingListeners.push({ action: 'once', event, handler });
    },
    emit(event, ...args) {
      pendingListeners.push({ action: 'emit', event, args });
    }
  };

  const checkInterval = setInterval(() => {
    if (typeof window !== 'undefined' && typeof window.io === 'function') {
      clearInterval(checkInterval);
      const realSocket = window.io(SERVER_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ['websocket', 'polling']
      });

      // Forward listeners
      pendingListeners.forEach(item => {
        if (item.action === 'on') realSocket.on(item.event, item.handler);
        else if (item.action === 'once') realSocket.once(item.event, item.handler);
        else if (item.action === 'emit') realSocket.emit(item.event, ...item.args);
      });

      // Update placeholder references
      Object.assign(placeholder, realSocket);
      placeholder.connected = realSocket.connected;
    }
  }, 200);

  return placeholder;
}

export const socket = createSocket();

/**
 * Join a specific order session room on the backend server
 * @param {string} orderId 
 */
export function joinOrderSession(orderId) {
  if (!orderId) return;

  if (socket.connected) {
    socket.emit('join_order_room', orderId);
  } else {
    socket.once('connect', () => {
      socket.emit('join_order_room', orderId);
    });
  }
}
