import express, { Request, Response } from 'express';
import { connectFranken } from '../../8sleep/frankenServer.js';
import { DeviceStatus, DeviceStatusSchema } from './deviceStatusSchema.js';
import logger from '../../logger.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';
import { DeepPartial } from 'ts-essentials';

const router = express.Router();

router.get('/deviceStatus', async (req: Request, res: Response) => {
  const franken = await connectFranken();
  const resp = await franken.getDeviceStatus();
  res.json(resp);
});

// Debugging aid: the firmware's unparsed status text, to see what a Pod reports beyond what Free Sleep reads
router.get('/deviceStatus/raw', async (req: Request, res: Response) => {
  const franken = await connectFranken();
  res.type('text/plain').send(await franken.getRawDeviceStatus());
});


router.post('/deviceStatus', async (req: Request, res: Response) => {
  const { body } = req;
  const validationResult = DeviceStatusSchema.deepPartial().safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid device status update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.errors,
    });
    return;
  }

  await updateDeviceStatus(body as DeepPartial<DeviceStatus>);
  res.status(204).end();
});


export default router;
