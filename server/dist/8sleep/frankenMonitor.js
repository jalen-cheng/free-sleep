
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="47fc27be-7af3-5375-9bf7-4b69b85cad50")}catch(e){}}();
import moment from 'moment-timezone';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { connectFranken } from './frankenServer.js';
import { wait } from './promises.js';
import { MAX_TARGET_TEMPERATURE_F, MIN_TARGET_TEMPERATURE_F, Version, } from '../routes/deviceStatus/deviceStatusSchema.js';
import { GestureSchema } from '../db/settingsSchema.js';
import { countNewGestures, processSideGestures } from './gestures.js';
import config from '../config.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import serverStatus from '../serverStatus.js';
const SIDES = ['left', 'right'];
// Pods without tap support only need an occasional status refresh
const STATUS_POLL_INTERVAL_MS = 60_000;
// Keep the old 2s pause after a failed poll so a broken socket is not hammered at the gesture rate
const RETRY_WAIT_MS = 2_000;
export class FrankenMonitor {
    isRunning;
    deviceStatus;
    constructor() {
        this.isRunning = false;
        this.deviceStatus = undefined;
    }
    async start() {
        if (this.isRunning) {
            logger.warn('FrankenMonitor is already running');
            return;
        }
        this.isRunning = true;
        this.frankenLoop().catch(error => {
            logger.error(error);
            serverStatus.status.frankenMonitor.status = 'failed';
            serverStatus.status.frankenMonitor.message = String(error);
            serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
        });
    }
    stop() {
        if (!this.isRunning)
            return;
        logger.debug('Stopping FrankenMonitor loop');
        this.isRunning = false;
    }
    // Runs the configured actions for every tap gesture a side made since the last poll.
    async processGesturesForSide(nextDeviceStatus, side) {
        try {
            await processSideGestures({
                previousTaps: this.deviceStatus?.[side].taps,
                nextTaps: nextDeviceStatus[side].taps,
                tapSettings: settingsDB.data[side].taps,
                targetTemperatureF: nextDeviceStatus[side].targetTemperatureF,
                temperatureLimits: { minTemperatureF: MIN_TARGET_TEMPERATURE_F, maxTemperatureF: MAX_TARGET_TEMPERATURE_F },
                actions: {
                    setTargetTemperature: async (temperatureF) => {
                        logger.debug(`Processing gesture temperature change for ${side} -> ${temperatureF}`);
                        await updateDeviceStatus({ [side]: { targetTemperatureF: temperatureF } });
                    },
                    runAlarmGesture: async () => {
                        // TODO: Add alarm handling
                        logger.warn('Skipping gesture...');
                    },
                },
            });
        }
        catch (error) {
            logger.error(error);
        }
    }
    // True when any tap counter moved forward, so settings are only read from disk when needed.
    hasNewGestures(nextDeviceStatus) {
        return SIDES.some(side => GestureSchema.options.some(gesture => (countNewGestures(this.deviceStatus?.[side].taps?.[gesture], nextDeviceStatus[side].taps?.[gesture]) > 0)));
    }
    async processGestures(nextDeviceStatus) {
        if (!this.deviceStatus) {
            logger.warn('Missing current deviceStatus, exiting...');
            return;
        }
        if (!this.hasNewGestures(nextDeviceStatus))
            return;
        await settingsDB.read();
        for (const side of SIDES) {
            await this.processGesturesForSide(nextDeviceStatus, side);
        }
    }
    async frankenLoop() {
        const franken = await connectFranken();
        this.deviceStatus = await franken.getDeviceStatus(false);
        let hasGestures = this.deviceStatus.coverVersion !== Version.Pod3;
        let waitTime = hasGestures ? config.gesturePollIntervalMs : STATUS_POLL_INTERVAL_MS;
        if (hasGestures) {
            this.deviceStatus = await franken.getDeviceStatus(true);
            logger.debug(`Gestures supported for ${this.deviceStatus.coverVersion}`);
        }
        else {
            logger.debug(`Gestures not supported for ${this.deviceStatus.coverVersion}`);
        }
        // No point in querying device status every 3 seconds for checking the prime status...
        while (this.isRunning) {
            try {
                while (this.isRunning) {
                    hasGestures = this.deviceStatus.coverVersion !== Version.Pod3;
                    waitTime = hasGestures ? config.gesturePollIntervalMs : STATUS_POLL_INTERVAL_MS;
                    await wait(waitTime);
                    if (!this.isRunning)
                        break;
                    const franken = await connectFranken();
                    // Quiet: at the gesture poll rate, per-message debug logs would flood the log file
                    const nextDeviceStatus = await franken.getDeviceStatus(hasGestures, hasGestures);
                    if (hasGestures) {
                        await this.processGestures(nextDeviceStatus);
                    }
                    this.deviceStatus = nextDeviceStatus;
                    serverStatus.status.frankenMonitor.status = 'healthy';
                    serverStatus.status.frankenMonitor.message = '';
                    serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
                }
            }
            catch (error) {
                serverStatus.status.frankenMonitor.status = 'failed';
                serverStatus.status.frankenMonitor.message = String(error);
                serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
                logger.error(error instanceof Error ? error.message : String(error), 'franken disconnected');
                await wait(Math.max(waitTime, RETRY_WAIT_MS));
            }
        }
        logger.debug('FrankenMonitor loop exited');
    }
}
//# sourceMappingURL=frankenMonitor.js.map
//# debugId=47fc27be-7af3-5375-9bf7-4b69b85cad50
