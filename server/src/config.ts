import { existsSync, readFileSync } from 'fs';
import logger from './logger.js';


function checkIfDacSockPathConfigured(): string | undefined {
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
  } catch (error) {
    logger.error(error);
  }
}


type FirmwareVersion = 'pod3FirmwareReset' | 'pod4FirmwareReset' | 'remoteDevMode';

interface FirmwareConfig {
  dacLocation: string;
}

const FIRMWARE_MAP: Record<FirmwareVersion, FirmwareConfig> = {
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
function loadGesturePollIntervalMs(): number {
  const configuredInterval = Number(process.env.GESTURE_POLL_INTERVAL_MS);
  if (!Number.isFinite(configuredInterval) || configuredInterval <= 0) return DEFAULT_GESTURE_POLL_INTERVAL_MS;
  return Math.max(MIN_GESTURE_POLL_INTERVAL_MS, configuredInterval);
}


class Config {
  // eslint-disable-next-line no-use-before-define
  private static instance: Config;
  public dbFolder: string;
  public lowDbFolder: string;
  public remoteDevMode: boolean;
  public dacSockPath: string;
  public gesturePollIntervalMs: number;

  private constructor() {
    if (!process.env.DATA_FOLDER || !process.env.ENV) {
      throw new Error('Missing DATA_FOLDER || ENV in env');
    }
    this.remoteDevMode = process.env.ENV === 'local';
    this.dacSockPath = this.detectSockPath();
    this.dbFolder = process.env.DATA_FOLDER;
    this.lowDbFolder = `${this.dbFolder}lowdb/`;
    this.gesturePollIntervalMs = loadGesturePollIntervalMs();
  }


  private detectSockPath(): string {
    const dacSockPath = checkIfDacSockPathConfigured();

    if (dacSockPath) {
      logger.debug(`'Custom dac.sock path configured, using ${dacSockPath}`);
      return dacSockPath;
    } else if (!this.remoteDevMode){
      logger.debug('No dac.sock path configured, defaulting to pod 3 path');
      return FIRMWARE_MAP.pod3FirmwareReset.dacLocation;

    } else if (this.remoteDevMode) {
      return FIRMWARE_MAP.remoteDevMode.dacLocation;
    } else {
      throw new Error('Error - Did not detect device firmware');
    }
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}

export default Config.getInstance();
