import { ChildProcess, spawn } from 'child_process';
import { createInterface } from 'readline';
import logger from '../logger.js';
import config from '../config.js';
import settingsDB from '../db/settings.js';
import { Side } from '../db/schedulesSchema.js';
import { Version } from '../routes/deviceStatus/deviceStatusSchema.js';
import { connectFranken } from './frankenServer.js';
import { ButtonPress, countPressesAsGestures, createButtonLineParser, isPowerHold } from './buttonEvents.js';
import { runSideGestures, setSidePower } from './gestureActions.js';

// Presses are collected for this long before acting, so a quick run of "+" presses becomes one
// temperature change from one reading of the current target
const PRESS_BATCH_MS = 400;
// Pause before reopening the firmware log if following it stops
const RESTART_WAIT_MS = 5_000;

// Follows the firmware's log on a Pod 5 and runs the configured action for each button press.
// The Pod 5's buttons do not show up in the tap counters that FrankenMonitor polls.
export class ButtonMonitor {
  private isRunning = false;
  private logFollower?: ChildProcess;
  private pendingPresses: Record<Side, ButtonPress[]> = { left: [], right: [] };
  private batchTimer?: NodeJS.Timeout;
  // Batches run one after another, so two never read and change the same target at once
  private batchQueue: Promise<void> = Promise.resolve();

  public async start() {
    if (this.isRunning) return;
    const franken = await connectFranken();
    const { coverVersion } = await franken.getDeviceStatus(false, true);
    if (coverVersion !== Version.Pod5) {
      logger.debug(`Button monitor not needed for ${coverVersion}`);
      return;
    }
    this.isRunning = true;
    this.followFirmwareLog();
    logger.info('Button monitor started');
  }

  public stop() {
    this.isRunning = false;
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.logFollower?.kill();
  }

  // Streams new lines of the firmware's journal. Starting at the end (`-n 0`) means presses made
  // before the server started are never replayed.
  private followFirmwareLog() {
    const parseLine = createButtonLineParser();
    const logFollower = spawn('journalctl', ['-u', config.firmwareLogUnit, '-f', '-n', '0', '-o', 'cat'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    this.logFollower = logFollower;

    createInterface({ input: logFollower.stdout! }).on('line', (line) => {
      const press = parseLine(line);
      if (press) this.addPress(press);
    });
    logFollower.on('error', error => logger.error(`Button monitor could not read the firmware log: ${error.message}`));
    logFollower.on('close', () => {
      if (!this.isRunning) return;
      logger.warn('Button monitor lost the firmware log, reopening...');
      setTimeout(() => {
        if (this.isRunning) this.followFirmwareLog();
      }, RESTART_WAIT_MS);
    });
  }

  private addPress(press: ButtonPress) {
    logger.debug(`Button press: ${press.side} ${press.button}${press.heldMs === undefined ? '' : ` held ${press.heldMs}ms`}`);
    this.pendingPresses[press.side].push(press);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      const presses = this.pendingPresses;
      this.pendingPresses = { left: [], right: [] };
      this.batchQueue = this.batchQueue.then(() => this.runBatch(presses));
    }, PRESS_BATCH_MS);
  }

  // Acts on one batch of presses: power holds first, then everything else through the same
  // gesture settings the tap counters use.
  private async runBatch(presses: Record<Side, ButtonPress[]>) {
    try {
      const franken = await connectFranken();
      const deviceStatus = await franken.getDeviceStatus(false, true);
      await settingsDB.read();
      for (const side of Object.keys(presses) as Side[]) {
        const sidePresses = presses[side];
        if (sidePresses.length === 0) continue;
        if (sidePresses.some(isPowerHold)) {
          logger.debug(`Middle button held on ${side}, switching power`);
          await setSidePower(side, !deviceStatus[side].isOn);
          continue;
        }
        // The gesture code works on counters, so presses are passed as a count starting from zero
        await runSideGestures(side, deviceStatus, { doubleTap: 0, tripleTap: 0, quadTap: 0 }, {
          doubleTap: 0, tripleTap: 0, quadTap: 0, ...countPressesAsGestures(sidePresses),
        });
      }
    } catch (error) {
      logger.error(error);
    }
  }
}
