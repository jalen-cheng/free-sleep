
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="7cc2dff9-d602-5369-a983-09272f81f724")}catch(e){}}();
import schedule from 'node-schedule';
import cbor from 'cbor';
import moment from 'moment-timezone';
import logger from '../logger.js';
import memoryDB from '../db/memoryDB.js';
import serverStatus from '../serverStatus.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { executeFunction } from '../8sleep/deviceApi.js';
import { getDayIndexForSchedule, logJob } from './utils.js';
import { connectFranken } from '../8sleep/frankenServer.js';
import { createAlarmSession } from './alarmSession.js';
export const executeAlarm = async ({ vibrationIntensity, duration, vibrationPattern, side, force = false }) => {
    try {
        const min10Duration = Math.max(10, duration);
        // Exit is side is in away mode
        await settingsDB.read();
        if (settingsDB.data[side].awayMode && !force) {
            if (settingsDB.data[side].awayMode) {
                logger.debug('Not executing alarm, this side is in away mode!');
                return;
            }
        }
        // Exit if side is off
        const franken = await connectFranken();
        const resp = await franken.getDeviceStatus();
        if (!resp[side].isOn && !force) {
            logger.debug('Not executing alarm, side is off!');
            return;
        }
        const currentTime = moment.tz(settingsDB.data.timeZone);
        const alarmTimeEpoch = currentTime.unix();
        const alarmPayload = {
            pl: vibrationIntensity,
            du: min10Duration,
            pi: vibrationPattern,
            tt: alarmTimeEpoch,
        };
        const cborPayload = cbor.encode(alarmPayload);
        const hexPayload = cborPayload.toString('hex');
        const command = side === 'left' ? 'ALARM_LEFT' : 'ALARM_RIGHT';
        logger.debug(`Executing alarm... ${JSON.stringify(alarmPayload)}`);
        await executeFunction(command, hexPayload);
        // eslint-disable-next-line no-use-before-define
        await alarmSession.alarmStarted({ vibrationIntensity, duration, vibrationPattern, side, force }, min10Duration);
        serverStatus.status.alarmSchedule.status = 'healthy';
        serverStatus.status.alarmSchedule.message = '';
    }
    catch (error) {
        serverStatus.status.alarmSchedule.status = 'failed';
        const message = error instanceof Error ? error.message : String(error);
        serverStatus.status.alarmSchedule.message = message;
        logger.error(error);
    }
};
// Owns the per-side alarm timers (end of vibration, snooze). A snoozed alarm re-runs executeAlarm.
export const alarmSession = createAlarmSession({
    startAlarm: executeAlarm,
    setAlarmVibrating: async (side, isAlarmVibrating) => {
        await memoryDB.read();
        memoryDB.data[side].isAlarmVibrating = isAlarmVibrating;
        await memoryDB.write();
    },
    logDebug: message => logger.debug(message),
});
/**
 * Next occurrence of HH:mm in tz (today or tomorrow depending on 'now').
 * If the HH:mm is already passed for 'now', schedule for tomorrow.
 */
function nextOccurrenceHhMm(tz, hhmm) {
    const now = moment.tz(tz);
    const [h, m] = hhmm.split(':').map(Number);
    const candidate = now.clone().hour(h).minute(m).second(0).millisecond(0);
    if (candidate.isSameOrBefore(now)) {
        candidate.add(1, 'day');
    }
    return candidate;
}
export function scheduleAlarmOverride(settingsData, side) {
    const alarmOverride = settingsData[side]?.scheduleOverrides?.alarm;
    if (!alarmOverride || alarmOverride.disabled)
        return null;
    if (!alarmOverride.timeOverride || !alarmOverride.expiresAt)
        return null;
    const now = moment.tz(settingsData.timeZone);
    const expiresAt = moment.tz(alarmOverride.expiresAt, settingsData.timeZone);
    if (!expiresAt.isAfter(now))
        return null;
    const next = nextOccurrenceHhMm(settingsData.timeZone, alarmOverride.timeOverride);
    logger.debug(`Alarm override is set! Scheduling alarm for ${next.format()}`);
    schedule.scheduleJob(`${side}-alarm-override-${alarmOverride.timeOverride}`, next.toDate(), async () => {
        const dayKey = next.tz(settingsData.timeZone).format('dddd').toLowerCase();
        const daySchedule = schedulesDB.data?.[side]?.[dayKey];
        const { vibrationIntensity, duration, vibrationPattern } = daySchedule?.alarm ?? {
            vibrationIntensity: 100,
            duration: 60,
            vibrationPattern: 'rise',
        };
        await executeAlarm({
            side,
            vibrationIntensity,
            duration,
            vibrationPattern,
        });
    });
}
export const scheduleAlarm = (settingsData, side, day, dailySchedule) => {
    if (!dailySchedule.power.enabled)
        return;
    if (!dailySchedule.alarm.enabled)
        return;
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
    const alarmRule = new schedule.RecurrenceRule();
    const dayIndex = getDayIndexForSchedule(day, dailySchedule.alarm.time, dailySchedule.power.on);
    alarmRule.dayOfWeek = dayIndex;
    const { time } = dailySchedule.alarm;
    const [alarmHour, alarmMinute] = time.split(':').map(Number);
    alarmRule.hour = alarmHour;
    alarmRule.minute = alarmMinute;
    alarmRule.tz = settingsData.timeZone;
    logJob('Scheduling alarm job', side, day, dayIndex, time);
    schedule.scheduleJob(`${side}-${day}-${time}-alarm`, alarmRule, async () => {
        try {
            logJob('Executing alarm job', side, day, dayIndex, time);
            await settingsDB.read();
            if (settingsDB.data[side].scheduleOverrides.alarm.expiresAt) {
                const expiresAt = moment(settingsDB.data[side].scheduleOverrides.alarm.expiresAt);
                const now = moment();
                if (expiresAt.isAfter(now)) {
                    logJob(`Detected alarm override! Skipping alarm! Override expires at: ${expiresAt.format()}`, side, day, dayIndex, time);
                    return;
                }
            }
            await executeAlarm({
                side,
                vibrationIntensity: dailySchedule.alarm.vibrationIntensity,
                duration: dailySchedule.alarm.duration,
                vibrationPattern: dailySchedule.alarm.vibrationPattern,
            });
        }
        catch (error) {
            serverStatus.status.alarmSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.alarmSchedule.message = message;
            logger.error(error);
        }
    });
};
//# sourceMappingURL=alarmScheduler.js.map
//# debugId=7cc2dff9-d602-5369-a983-09272f81f724
