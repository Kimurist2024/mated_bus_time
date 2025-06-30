// Firebase操作用サービスクラス
class FirebaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    // Firebase初期化
    async initialize() {
        try {
            debugLog('Firebase初期化開始');
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            
            // 接続テスト
            await this.db.collection('busStops').limit(1).get();
            
            this.isInitialized = true;
            debugLog('Firebase初期化完了');
            return true;
        } catch (error) {
            console.error('Firebase初期化エラー:', error);
            this.retryCount++;
            
            if (this.retryCount < this.maxRetries) {
                debugLog(`Firebase初期化リトライ (${this.retryCount}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.initialize();
            }
            
            return false;
        }
    }

    // バス停データを取得
    async getBusStops() {
        if (!this.isInitialized) {
            throw new Error('Firebase is not initialized');
        }

        try {
            debugLog('バス停データ取得開始');
            const snapshot = await this.db.collection('busStops')
                .orderBy('name')
                .get();
            
            const busStops = [];
            snapshot.forEach(doc => {
                busStops.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            debugLog(`バス停データ取得完了: ${busStops.length}件`);
            return busStops;
        } catch (error) {
            console.error('バス停データ取得エラー:', error);
            throw error;
        }
    }

    // 時刻表データを取得
    async getTimetables() {
        if (!this.isInitialized) {
            throw new Error('Firebase is not initialized');
        }

        try {
            debugLog('時刻表データ取得開始');
            const snapshot = await this.db.collection('timetables').get();
            const timetables = {};
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!timetables[data.busStopId]) {
                    timetables[data.busStopId] = [];
                }
                timetables[data.busStopId].push({
                    id: doc.id,
                    ...data
                });
            });

            debugLog(`時刻表データ取得完了: ${Object.keys(timetables).length}バス停分`);
            return timetables;
        } catch (error) {
            console.error('時刻表データ取得エラー:', error);
            throw error;
        }
    }

    // 新しいバス停を追加
    async addBusStop(stopData) {
        if (!this.isInitialized) {
            throw new Error('Firebase is not initialized');
        }

        try {
            debugLog('バス停追加開始', stopData.name);
            
            // バリデーション
            this.validateBusStopData(stopData);
            
            const docRef = await this.db.collection('busStops').add({
                name: stopData.name,
                location: {
                    lat: parseFloat(stopData.lat),
                    lng: parseFloat(stopData.lng)
                },
                routes: stopData.routes || [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            debugLog(`バス停追加完了: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error('バス停追加エラー:', error);
            throw error;
        }
    }

    // 時刻表を追加
    async addTimetable(timetableData) {
        if (!this.isInitialized) {
            throw new Error('Firebase is not initialized');
        }

        try {
            debugLog('時刻表追加開始', timetableData);
            
            // バリデーション
            this.validateTimetableData(timetableData);
            
            const docRef = await this.db.collection('timetables').add({
                busStopId: timetableData.busStopId,
                routeName: timetableData.routeName,
                destination: timetableData.destination,
                weekdayTimes: timetableData.weekdayTimes || [],
                saturdayTimes: timetableData.saturdayTimes || [],
                sundayTimes: timetableData.sundayTimes || [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            debugLog(`時刻表追加完了: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error('時刻表追加エラー:', error);
            throw error;
        }
    }

    // バス停を削除
    async deleteBusStop(stopId) {
        if (!this.isInitialized) {
            throw new Error('Firebase is not initialized');
        }

        try {
            debugLog('バス停削除開始', stopId);
            
            // 関連する時刻表を検索
            const timetablesSnapshot = await this.db.collection('timetables')
                .where('busStopId', '==', stopId)
                .get();

            // バッチ処理で削除
            const batch = this.db.batch();
            
            // 時刻表削除
            timetablesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            // バス停削除
            const busStopRef = this.db.collection('busStops').doc(stopId);
            batch.delete(busStopRef);

            await batch.commit();
            debugLog(`バス停削除完了: ${stopId}`);
            return true;
        } catch (error) {
            console.error('バス停削除エラー:', error);
            throw error;
        }
    }

    // データバリデーション
    validateBusStopData(data) {
        if (!data.name || data.name.trim() === '') {
            throw new Error('バス停名は必須です');
        }
        
        if (!data.lat || !data.lng) {
            throw new Error('位置情報は必須です');
        }
        
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);
        
        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('緯度・経度は数値で入力してください');
        }
        
        if (lat < 35.7 || lat > 35.9 || lng < 139.8 || lng > 140.1) {
            throw new Error('松戸市周辺の座標を入力してください');
        }
    }

    validateTimetableData(data) {
        if (!data.busStopId) {
            throw new Error('バス停IDは必須です');
        }
        
        if (!data.routeName || data.routeName.trim() === '') {
            throw new Error('路線名は必須です');
        }
        
        if (!data.destination || data.destination.trim() === '') {
            throw new Error('行き先は必須です');
        }
        
        if (!data.weekdayTimes || data.weekdayTimes.length === 0) {
            throw new Error('平日の時刻は最低1つ必要です');
        }
    }

    // リアルタイムリスナー設定
    onBusStopsChange(callback) {
        if (!this.isInitialized) {
            throw new Error('Firebase is not initialized');
        }

        return this.db.collection('busStops').onSnapshot(callback);
    }

    onTimetablesChange(callback) {
        if (!this.isInitialized) {
            throw new Error('Firebase is not initialized');
        }

        return this.db.collection('timetables').onSnapshot(callback);
    }
}