// Firebase設定 - 松戸バス停システム用（実際の設定値）
const firebaseConfig = {
    apiKey: "yourkey",
    authDomain: "matsudo-bus-system.firebaseapp.com",
    projectId: "matsudo-bus-system",
    storageBucket: "matsudo-bus-system.firebasestorage.app",
    messagingSenderId: "446206515873",
    appId: "1:446206515873:web:3a0a1914c129909cda2ee0",
    measurementId: "G-TPJDJ0KL38"
};

// アプリケーション設定
const APP_CONFIG = {
    defaultCenter: { lat: 35.7848, lng: 139.9026 }, // 松戸駅
    defaultZoom: 13,
    maxZoom: 18,
    minZoom: 10,
    updateInterval: 30000,
    mapId: "DEMO_MAP_ID"
};

const DEBUG = true;

function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[🚌 BusMap] ${message}`, data || '');
    }
}
