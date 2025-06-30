// メインアプリケーションクラス
class BusMapApp {
    constructor() {
        this.firebaseService = new FirebaseService();
        this.busStops = [];
        this.timetables = {};
        this.selectedStopId = null;
        this.adminPanelVisible = false;
        this.map = null;
        this.markers = [];
        this.searchTerm = '';
    }

    // アプリケーション初期化
    async initialize() {
        try {
            this.showLoading();
            this.updateStatus('loading', 'Firebase接続中...');

            // Firebase初期化
            const firebaseInit = await this.firebaseService.initialize();
            if (!firebaseInit) {
                throw new Error('Firebase初期化に失敗しました');
            }

            // Google Maps初期化を待機
            await this.waitForGoogleMaps();
            this.initializeMap();

            // データ読み込み
            await this.loadData();

            // イベントリスナー設定
            this.setupEventListeners();

            this.updateStatus('connected', `${this.busStops.length}件のバス停を読み込みました`);
            this.hideLoading();

            debugLog('アプリケーション初期化完了');

        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            this.updateStatus('error', 'システムの初期化に失敗しました');
            this.hideLoading();
        }
    }

    // Google Maps APIの読み込み待機
    async waitForGoogleMaps() {
        return new Promise((resolve) => {
            if (window.google && window.google.maps) {
                resolve();
                return;
            }

            const checkGoogleMaps = () => {
                if (window.google && window.google.maps) {
                    resolve();
                } else {
                    setTimeout(checkGoogleMaps, 100);
                }
            };
            checkGoogleMaps();
        });
    }

    // Google Maps初期化
    initializeMap() {
        this.map = document.getElementById('map');
        if (!this.map) {
            throw new Error('マップ要素が見つかりません');
        }

        // マップクリックイベント
        this.map.addEventListener('gmp-click', (event) => {
            if (this.adminPanelVisible) {
                const coords = event.detail.latLng;
                document.getElementById('newStopLat').value = coords.lat.toFixed(6);
                document.getElementById('newStopLng').value = coords.lng.toFixed(6);
            }
        });

        debugLog('Google Maps初期化完了');
    }

    // データ読み込み
    async loadData() {
        try {
            debugLog('データ読み込み開始');
            
            // バス停データ取得
            this.busStops = await this.firebaseService.getBusStops();
            
            // 時刻表データ取得
            this.timetables = await this.firebaseService.getTimetables();
            
            // UI更新
            this.displayBusStops();
            this.displayMarkers();
            this.updateBusStopSelect();
            this.updateMarkerCount();
            
            debugLog('データ読み込み完了');
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            throw error;
        }
    }

    // バス停マーカーを表示（修正版）
    displayMarkers() {
        // 既存のマーカーをクリア
        this.clearMarkers();

        this.busStops.forEach(stop => {
            const marker = document.createElement('gmp-advanced-marker');
            
            // 🔧 座標設定を修正 - setAttribute を使用
            marker.setAttribute('position', `${stop.location.lat},${stop.location.lng}`);
            marker.setAttribute('title', stop.name);
            
            // カスタムマーカーアイコン
            const icon = document.createElement('div');
            icon.className = 'custom-bus-marker';
            icon.innerHTML = '🚌';
            icon.style.cssText = `
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #3498db, #2980b9);
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: transform 0.3s ease;
            `;
            
            icon.addEventListener('mouseenter', () => {
                icon.style.transform = 'scale(1.2)';
            });
            
            icon.addEventListener('mouseleave', () => {
                icon.style.transform = 'scale(1)';
            });
            
            marker.appendChild(icon);

            // クリックイベント
            marker.addEventListener('gmp-click', () => {
                this.showInfoWindow(stop, marker);
                this.selectBusStop(stop.id);
            });

            this.map.appendChild(marker);
            this.markers.push({ marker, stop });
        });

        debugLog(`${this.markers.length}個のマーカーを表示`);
    }

    // 情報ウィンドウを表示
    showInfoWindow(stop, marker) {
        const stopTimetables = this.timetables[stop.id] || [];
        
        let content = `
            <div class="info-window">
                <div class="popup-header">${stop.name}</div>
        `;

        if (stopTimetables.length === 0) {
            content += '<p style="padding: 15px; color: #7f8c8d; text-align: center;">時刻表データがありません</p>';
        } else {
            stopTimetables.forEach(timetable => {
                content += `
                    <div class="route-section">
                        <div class="route-header">${timetable.routeName} - ${timetable.destination}</div>
                        <div class="timetable">
                `;

                const times = this.getTodayTimes(timetable);
                const currentTime = this.getCurrentTimeString();

                if (times.length === 0) {
                    content += '<p style="color: #7f8c8d; text-align: center; padding: 10px;">本日の運行はありません</p>';
                } else {
                    times.forEach(time => {
                        const isNext = this.isNextBus(time, times, currentTime);
                        const cssClass = isNext ? 'current-time' : '';
                        
                        content += `
                            <div class="time-row ${cssClass}">
                                <span class="time">${time}</span>
                                <span class="destination">${timetable.destination}</span>
                                ${isNext ? '<span style="margin-left: auto; font-size: 12px;">⏰ 次のバス</span>' : ''}
                            </div>
                        `;
                    });
                }

                content += '</div></div>';
            });
        }

        content += '</div>';

        // 既存の情報ウィンドウがあれば削除
        const existingInfo = this.map.querySelector('.info-window-container');
        if (existingInfo) {
            existingInfo.remove();
        }

        // 新しい情報ウィンドウを作成
        const infoContainer = document.createElement('div');
        infoContainer.className = 'info-window-container';
        infoContainer.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 400px;
            min-width: 320px;
            pointer-events: auto;
        `;
        infoContainer.innerHTML = content;

        // 閉じるボタンを追加
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255,255,255,0.9);
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            color: #666;
            z-index: 1001;
        `;
        closeBtn.addEventListener('click', () => {
            infoContainer.remove();
        });
        infoContainer.appendChild(closeBtn);

        this.map.appendChild(infoContainer);
        
        // 位置調整
        setTimeout(() => {
            infoContainer.style.left = '50px';
            infoContainer.style.top = '50px';
        }, 0);
    }

    // 今日の時刻表を取得
    getTodayTimes(timetable) {
        const today = new Date().getDay();
        
        if (today === 0) { // 日曜日
            return timetable.sundayTimes || timetable.weekdayTimes || [];
        } else if (today === 6) { // 土曜日
            return timetable.saturdayTimes || timetable.weekdayTimes || [];
        } else { // 平日
            return timetable.weekdayTimes || [];
        }
    }

    // 現在時刻を文字列で取得
    getCurrentTimeString() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // 次のバスかどうか判定
    isNextBus(time, allTimes, currentTime) {
        if (time <= currentTime) return false;
        
        const futureTimes = allTimes.filter(t => t > currentTime);
        return futureTimes.length > 0 && time === futureTimes[0];
    }

    // バス停リストを表示
    displayBusStops(filteredStops = null) {
        const stopsToShow = filteredStops || this.busStops;
        const listContainer = document.getElementById('busStopList');
        
        if (stopsToShow.length === 0) {
            listContainer.innerHTML = `
                <div class="loading-message">
                    ${this.searchTerm ? '該当するバス停が見つかりません' : 'バス停データがありません'}
                </div>
            `;
            return;
        }

        listContainer.innerHTML = stopsToShow.map(stop => {
            const stopTimetables = this.timetables[stop.id] || [];
            const routeCount = stopTimetables.length;
            
            return `
                <div class="bus-stop-item" data-stop-id="${stop.id}">
                    ${this.adminPanelVisible ? `<button class="delete-btn" onclick="app.deleteBusStop('${stop.id}')" title="削除">×</button>` : ''}
                    <div class="stop-name">${stop.name}</div>
                    <div class="stop-routes">路線: ${stop.routes ? stop.routes.join(', ') : '未設定'}</div>
                    <div class="stop-meta">
                        <span>${routeCount}路線の時刻表</span>
                        <span>ID: ${stop.id.substring(0, 8)}...</span>
                    </div>
                </div>
            `;
        }).join('');

        // イベントリスナーを追加
        document.querySelectorAll('.bus-stop-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) return;
                const stopId = item.getAttribute('data-stop-id');
                this.selectBusStop(stopId);
            });
        });
    }

    // バス停選択（修正版）
    selectBusStop(stopId) {
        this.selectedStopId = stopId;
        
        // リストの選択状態を更新
        document.querySelectorAll('.bus-stop-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-stop-id="${stopId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // 🔧 マップの中心を移動 - setAttribute を使用
        const stop = this.busStops.find(s => s.id === stopId);
        if (stop && this.map) {
            this.map.setAttribute('center', `${stop.location.lat},${stop.location.lng}`);
            this.map.setAttribute('zoom', '16');
        }
    }

    // マーカーをクリア
    clearMarkers() {
        this.markers.forEach(({ marker }) => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
        });
        this.markers = [];
    }

    // イベントリスナー設定
    setupEventListeners() {
        // 検索機能
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            const filteredStops = this.busStops.filter(stop => 
                stop.name.toLowerCase().includes(this.searchTerm) ||
                (stop.routes && stop.routes.some(route => 
                    route.toLowerCase().includes(this.searchTerm)
                ))
            );
            this.displayBusStops(filteredStops);
        });

        // ESCキーで管理パネルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.adminPanelVisible) {
                this.toggleAdminPanel();
            }
        });

        debugLog('イベントリスナー設定完了');
    }

    // 管理パネルの表示/非表示切り替え
    toggleAdminPanel() {
        this.adminPanelVisible = !this.adminPanelVisible;
        const panel = document.getElementById('adminPanel');
        
        if (this.adminPanelVisible) {
            panel.classList.add('active');
            this.updateBusStopSelect();
        } else {
            panel.classList.remove('active');
        }
        
        // バス停リストを再表示（削除ボタンの表示/非表示のため）
        this.displayBusStops();
        
        debugLog(`管理パネル: ${this.adminPanelVisible ? '表示' : '非表示'}`);
    }

    // バス停選択ドロップダウンを更新
    updateBusStopSelect() {
        const select = document.getElementById('selectBusStop');
        if (!select) return;

        select.innerHTML = '<option value="">バス停を選択</option>';
        
        this.busStops.forEach(stop => {
            const option = document.createElement('option');
            option.value = stop.id;
            option.textContent = stop.name;
            select.appendChild(option);
        });
    }

    // マーカー数を更新
    updateMarkerCount() {
        const countElement = document.getElementById('markerCount');
        if (countElement) {
            countElement.textContent = this.busStops.length;
        }
    }

    // 新しいバス停を追加
    async addBusStop() {
        try {
            const name = document.getElementById('newStopName').value.trim();
            const lat = document.getElementById('newStopLat').value;
            const lng = document.getElementById('newStopLng').value;
            const routesText = document.getElementById('newStopRoutes').value.trim();
            
            if (!name || !lat || !lng) {
                alert('バス停名、緯度、経度は必須項目です');
                return;
            }

            const routes = routesText ? routesText.split(',').map(r => r.trim()) : [];

            this.updateStatus('loading', 'バス停追加中...');
            
            const stopId = await this.firebaseService.addBusStop({
                name,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                routes
            });

            // フォームをクリア
            document.getElementById('newStopName').value = '';
            document.getElementById('newStopLat').value = '';
            document.getElementById('newStopLng').value = '';
            document.getElementById('newStopRoutes').value = '';

            // データを再読み込み
            await this.loadData();
            
            this.updateStatus('connected', `バス停「${name}」を追加しました`);
            debugLog(`バス停追加完了: ${name} (${stopId})`);

        } catch (error) {
            console.error('バス停追加エラー:', error);
            this.updateStatus('error', 'バス停の追加に失敗しました');
            alert(`エラー: ${error.message}`);
        }
    }

    // 時刻表を追加
    async addTimetable() {
        try {
            const busStopId = document.getElementById('selectBusStop').value;
            const routeName = document.getElementById('newRouteName').value.trim();
            const destination = document.getElementById('newDestination').value.trim();
            const weekdayTimesText = document.getElementById('newWeekdayTimes').value.trim();
            const saturdayTimesText = document.getElementById('newSaturdayTimes').value.trim();
            const sundayTimesText = document.getElementById('newSundayTimes').value.trim();

            if (!busStopId || !routeName || !destination || !weekdayTimesText) {
                alert('バス停、路線名、行き先、平日時刻は必須項目です');
                return;
            }

            const weekdayTimes = weekdayTimesText.split(',').map(t => t.trim()).filter(t => t);
            const saturdayTimes = saturdayTimesText ? saturdayTimesText.split(',').map(t => t.trim()).filter(t => t) : [];
            const sundayTimes = sundayTimesText ? sundayTimesText.split(',').map(t => t.trim()).filter(t => t) : [];

            this.updateStatus('loading', '時刻表追加中...');

            const timetableId = await this.firebaseService.addTimetable({
                busStopId,
                routeName,
                destination,
                weekdayTimes,
                saturdayTimes,
                sundayTimes
            });

            // フォームをクリア
            document.getElementById('selectBusStop').value = '';
            document.getElementById('newRouteName').value = '';
            document.getElementById('newDestination').value = '';
            document.getElementById('newWeekdayTimes').value = '';
            document.getElementById('newSaturdayTimes').value = '';
            document.getElementById('newSundayTimes').value = '';

            // データを再読み込み
            await this.loadData();

            this.updateStatus('connected', `時刻表「${routeName}」を追加しました`);
            debugLog(`時刻表追加完了: ${routeName} (${timetableId})`);

        } catch (error) {
            console.error('時刻表追加エラー:', error);
            this.updateStatus('error', '時刻表の追加に失敗しました');
            alert(`エラー: ${error.message}`);
        }
    }

    // バス停を削除
    async deleteBusStop(stopId) {
        const stop = this.busStops.find(s => s.id === stopId);
        if (!stop) return;

        if (!confirm(`「${stop.name}」を削除しますか？\n関連する時刻表も全て削除されます。`)) {
            return;
        }

        try {
            this.updateStatus('loading', 'バス停削除中...');
            
            await this.firebaseService.deleteBusStop(stopId);
            
            // データを再読み込み
            await this.loadData();
            
            this.updateStatus('connected', `バス停「${stop.name}」を削除しました`);
            debugLog(`バス停削除完了: ${stop.name}`);

        } catch (error) {
            console.error('バス停削除エラー:', error);
            this.updateStatus('error', 'バス停の削除に失敗しました');
            alert(`エラー: ${error.message}`);
        }
    }

    // データを更新
    async refreshData() {
        try {
            this.updateStatus('loading', 'データ更新中...');
            await this.loadData();
            this.updateStatus('connected', `${this.busStops.length}件のバス停を更新しました`);
            debugLog('データ更新完了');
        } catch (error) {
            console.error('データ更新エラー:', error);
            this.updateStatus('error', 'データの更新に失敗しました');
        }
    }

    // サンプルデータを追加
    async addSampleData() {
        if (!confirm('サンプルデータを追加しますか？\n松戸市周辺のバス停と時刻表が追加されます。')) {
            return;
        }

        try {
            this.updateStatus('loading', 'サンプルデータ追加中...');
            
            const result = await addSampleData(this.firebaseService);
            
            // データを再読み込み
            await this.loadData();
            
            this.updateStatus('connected', 
                `サンプルデータを追加しました (バス停: ${result.stops}件, 時刻表: ${result.timetables}件)`
            );
            debugLog('サンプルデータ追加完了', result);

        } catch (error) {
            console.error('サンプルデータ追加エラー:', error);
            this.updateStatus('error', 'サンプルデータの追加に失敗しました');
            alert(`エラー: ${error.message}`);
        }
    }

    // 松戸駅に地図を戻す（修正版）
    centerOnMatsudo() {
        if (this.map) {
            // 🔧 setAttribute を使用
            this.map.setAttribute('center', `${APP_CONFIG.defaultCenter.lat},${APP_CONFIG.defaultCenter.lng}`);
            this.map.setAttribute('zoom', APP_CONFIG.defaultZoom.toString());
            debugLog('地図を松戸駅に戻しました');
        }
    }

    // ステータス表示を更新
    updateStatus(type, message) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        const iconMap = {
            loading: '⏳',
            connected: '✅',
            error: '❌'
        };

        statusElement.className = `status ${type}`;
        statusElement.innerHTML = `
            <span class="status-icon">${iconMap[type] || '⏳'}</span>
            <span class="status-text">${message}</span>
        `;
    }

    // ローディング表示
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    // ローディング非表示
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// グローバル変数
let app;

// アプリケーション初期化関数
async function initApp() {
    try {
        debugLog('アプリケーション起動開始');
        app = new BusMapApp();
        await app.initialize();
        debugLog('アプリケーション起動完了');
    } catch (error) {
        console.error('アプリケーション起動エラー:', error);
        
        // エラー画面表示
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-family: system-ui, -apple-system, sans-serif;
                text-align: center;
                padding: 20px;
            ">
                <div style="font-size: 4rem; margin-bottom: 20px;">🚌💥</div>
                <h1 style="margin-bottom: 20px;">システムエラー</h1>
                <p style="margin-bottom: 30px; max-width: 500px;">
                    アプリケーションの起動に失敗しました。<br>
                    Firebase設定またはGoogle Maps APIキーを確認してください。
                </p>
                <button onclick="location.reload()" style="
                    padding: 12px 24px;
                    background: rgba(255,255,255,0.2);
                    border: 2px solid white;
                    border-radius: 25px;
                    color: white;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    再読み込み
                </button>
                <details style="margin-top: 30px; max-width: 600px;">
                    <summary style="cursor: pointer; margin-bottom: 10px;">エラー詳細</summary>
                    <pre style="
                        background: rgba(0,0,0,0.3);
                        padding: 15px;
                        border-radius: 8px;
                        text-align: left;
                        font-size: 12px;
                        overflow: auto;
                    ">${error.stack || error.message}</pre>
                </details>
            </div>
        `;
    }
}

// DOMContentLoadedイベントで初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}