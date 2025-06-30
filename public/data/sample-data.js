// サンプルデータ
const SAMPLE_BUS_STOPS = [
    {
        name: "松戸駅東口",
        lat: 35.7848,
        lng: 139.9026,
        routes: ["松01", "松02", "松03", "市内循環"]
    },
    {
        name: "松戸駅西口",
        lat: 35.7838,
        lng: 139.9016,
        routes: ["松11", "松12", "市内循環"]
    },
    {
        name: "新松戸駅",
        lat: 35.8017,
        lng: 139.9347,
        routes: ["松01", "松21", "松31"]
    },
    {
        name: "小金原団地",
        lat: 35.8134,
        lng: 139.9578,
        routes: ["松02", "松22"]
    },
    {
        name: "常盤平駅南口",
        lat: 35.7747,
        lng: 139.9667,
        routes: ["松12", "松32"]
    },
    {
        name: "八柱駅北口",
        lat: 35.7614,
        lng: 139.9439,
        routes: ["松11", "松33"]
    }
];

const SAMPLE_TIMETABLES = [
    // 松戸駅東口
    {
        busStopName: "松戸駅東口",
        routeName: "松01",
        destination: "新松戸駅行き",
        weekdayTimes: ["07:15", "07:30", "07:45", "08:00", "08:15", "08:30", "08:45", "09:00"],
        saturdayTimes: ["07:20", "07:40", "08:00", "08:20", "08:40", "09:00", "09:20"],
        sundayTimes: ["07:30", "08:00", "08:30", "09:00", "09:30", "10:00"]
    },
    {
        busStopName: "松戸駅東口",
        routeName: "松02",
        destination: "小金原団地行き",
        weekdayTimes: ["07:20", "07:35", "07:50", "08:05", "08:20", "08:35", "08:50"],
        saturdayTimes: ["07:25", "07:45", "08:05", "08:25", "08:45", "09:05"],
        sundayTimes: ["07:35", "08:05", "08:35", "09:05", "09:35"]
    },
    {
        busStopName: "松戸駅東口",
        routeName: "市内循環",
        destination: "松戸駅西口経由",
        weekdayTimes: ["07:25", "07:55", "08:25", "08:55", "09:25"],
        saturdayTimes: ["07:30", "08:00", "08:30", "09:00", "09:30"],
        sundayTimes: ["08:00", "08:30", "09:00", "09:30", "10:00"]
    },
    
    // 松戸駅西口
    {
        busStopName: "松戸駅西口",
        routeName: "松11",
        destination: "八柱駅行き",
        weekdayTimes: ["07:18", "07:33", "07:48", "08:03", "08:18", "08:33"],
        saturdayTimes: ["07:23", "07:43", "08:03", "08:23", "08:43"],
        sundayTimes: ["07:33", "08:03", "08:33", "09:03", "09:33"]
    },
    {
        busStopName: "松戸駅西口",
        routeName: "松12",
        destination: "常盤平駅行き",
        weekdayTimes: ["07:22", "07:37", "07:52", "08:07", "08:22"],
        saturdayTimes: ["07:27", "07:47", "08:07", "08:27", "08:47"],
        sundayTimes: ["07:37", "08:07", "08:37", "09:07"]
    },
    
    // 新松戸駅
    {
        busStopName: "新松戸駅",
        routeName: "松01",
        destination: "松戸駅東口行き",
        weekdayTimes: ["07:12", "07:27", "07:42", "07:57", "08:12", "08:27"],
        saturdayTimes: ["07:17", "07:37", "07:57", "08:17", "08:37"],
        sundayTimes: ["07:27", "07:57", "08:27", "08:57", "09:27"]
    },
    {
        busStopName: "新松戸駅",
        routeName: "松21",
        destination: "柏駅東口行き",
        weekdayTimes: ["07:16", "07:31", "07:46", "08:01", "08:16"],
        saturdayTimes: ["07:21", "07:41", "08:01", "08:21", "08:41"],
        sundayTimes: ["07:31", "08:01", "08:31", "09:01"]
    }
];

// サンプルデータ追加関数
async function addSampleData(firebaseService) {
    try {
        debugLog('サンプルデータ追加開始');
        let addedStops = 0;
        let addedTimetables = 0;
        
        // バス停を追加
        const stopIds = {};
        for (const stop of SAMPLE_BUS_STOPS) {
            try {
                const stopId = await firebaseService.addBusStop({
                    name: stop.name,
                    lat: stop.lat,
                    lng: stop.lng,
                    routes: stop.routes
                });
                stopIds[stop.name] = stopId;
                addedStops++;
                debugLog(`バス停追加: ${stop.name} (ID: ${stopId})`);
            } catch (error) {
                console.warn(`バス停追加スキップ (既存の可能性): ${stop.name}`);
            }
        }
        
        // 時刻表を追加
        for (const timetable of SAMPLE_TIMETABLES) {
            const stopId = stopIds[timetable.busStopName];
            if (stopId) {
                try {
                    const timetableId = await firebaseService.addTimetable({
                        busStopId: stopId,
                        routeName: timetable.routeName,
                        destination: timetable.destination,
                        weekdayTimes: timetable.weekdayTimes,
                        saturdayTimes: timetable.saturdayTimes,
                        sundayTimes: timetable.sundayTimes
                    });
                    addedTimetables++;
                    debugLog(`時刻表追加: ${timetable.routeName} (ID: ${timetableId})`);
                } catch (error) {
                    console.warn(`時刻表追加エラー: ${timetable.routeName}`);
                }
            }
        }
        
        debugLog(`サンプルデータ追加完了: バス停${addedStops}件, 時刻表${addedTimetables}件`);
        return { stops: addedStops, timetables: addedTimetables };
        
    } catch (error) {
        console.error('サンプルデータ追加エラー:', error);
        throw error;
    }
}