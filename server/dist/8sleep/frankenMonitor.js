
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="2280adab-4217-5f6e-a4bf-0cf516dba154")}catch(e){}}();
import moment from 'moment-timezone';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { connectFranken } from './frankenServer.js';
import { wait } from './promises.js';
import { Version } from '../routes/deviceStatus/deviceStatusSchema.js';
import { GestureSchema } from '../db/settingsSchema.js';
import { countNewGestures } from './gestures.js';
import { runSideGestures } from './gestureActions.js';
import config from '../config.js';
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
            await runSideGestures(side, nextDeviceStatus, this.deviceStatus[side].taps, nextDeviceStatus[side].taps);
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
//# debugId=2280adab-4217-5f6e-a4bf-0cf516dba154
