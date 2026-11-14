
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="2510f531-b116-53b9-82d2-13bf6b608eca")}catch(e){}}();
import { existsSync, readFileSync } from 'fs';
import logger from './logger.js';
function checkIfDacSockPathConfigured() {
    try {
        // Check if the file exists
        const filePath = '/persistent/free-sleep-data/dac_sock_path.txt';
        if (!existsSync(filePath)) {
            logger.debug(`dac.sock path not configured, defaulting to pod 3 path...`);
            return;
        }
        const data = readFileSync(filePath, 'utf8');
        // Remove all newline characters
        return data.replace(/\r?\n/g, '');
    }
    catch (error) {
        logger.error(error);
    }
}
const FIRMWARE_MAP = {
    remoteDevMode: {
        dacLocation: `${process.env.DATA_FOLDER}/dac.sock`,
    },
    pod3FirmwareReset: {
        dacLocation: '/deviceinfo/dac.sock',
    },
    pod4FirmwareReset: {
        dacLocation: '/persistent/deviceinfo/dac.sock',
    },
};
const DEFAULT_GESTURE_POLL_INTERVAL_MS = 500;
const MIN_GESTURE_POLL_INTERVAL_MS = 100;
// How often to ask Frank for tap counters on Pods with tap support. Override with GESTURE_POLL_INTERVAL_MS.
function loadGesturePollIntervalMs() {
    const configuredInterval = Number(process.env.GESTURE_POLL_INTERVAL_MS);
    if (!Number.isFinite(configuredInterval) || configuredInterval <= 0)
        return DEFAULT_GESTURE_POLL_INTERVAL_MS;
    return Math.max(MIN_GESTURE_POLL_INTERVAL_MS, configuredInterval);
}
class Config {
    // eslint-disable-next-line no-use-before-define
    static instance;
    dbFolder;
    lowDbFolder;
    remoteDevMode;
    dacSockPath;
    gesturePollIntervalMs;
    // systemd unit whose journal carries Eight Sleep's firmware log (read for Pod 5 button presses)
    firmwareLogUnit;
    constructor() {
        if (!process.env.DATA_FOLDER || !process.env.ENV) {
            throw new Error('Missing DATA_FOLDER || ENV in env');
        }
        this.remoteDevMode = process.env.ENV === 'local';
        this.dacSockPath = this.detectSockPath();
        this.dbFolder = process.env.DATA_FOLDER;
        this.lowDbFolder = `${this.dbFolder}lowdb/`;
        this.gesturePollIntervalMs = loadGesturePollIntervalMs();
        this.firmwareLogUnit = process.env.FIRMWARE_LOG_UNIT || 'frank';
    }
    detectSockPath() {
        const dacSockPath = checkIfDacSockPathConfigured();
        if (dacSockPath) {
            logger.debug(`'Custom dac.sock path configured, using ${dacSockPath}`);
            return dacSockPath;
        }
        else if (!this.remoteDevMode) {
            logger.debug('No dac.sock path configured, defaulting to pod 3 path');
            return FIRMWARE_MAP.pod3FirmwareReset.dacLocation;
        }
        else if (this.remoteDevMode) {
            return FIRMWARE_MAP.remoteDevMode.dacLocation;
        }
        else {
            throw new Error('Error - Did not detect device firmware');
        }
    }
    static getInstance() {
        if (!Config.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }
}
export default Config.getInstance();
//# sourceMappingURL=config.js.map
//# debugId=2510f531-b116-53b9-82d2-13bf6b608eca
