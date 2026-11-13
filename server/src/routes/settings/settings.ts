import _ from 'lodash';
import express, { Request, Response } from 'express';
import logger from '../../logger.js';

const router = express.Router();

import settingsDB from '../../db/settings.js';
import { SettingsSchema, TapConfig } from '../../db/settingsSchema.js';

// Tap configs are one of two shapes picked by `type`. Replace them as a whole instead of merging,
// so switching type does not leave the other shape's fields behind in settingsDB.json.
const replaceTapConfig = (_existingValue: unknown, newValue: unknown) => {
  if (TapConfig.safeParse(newValue).success) return newValue;
  return undefined;
};

router.get('/settings', async (req: Request, res: Response) => {
  await settingsDB.read();
  res.json(settingsDB.data);
});


router.post('/settings', async (req: Request, res: Response) => {
  const { body } = req;
  const validationResult = SettingsSchema.deepPartial().safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid settings update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.errors,
    });
    return;
  }
  delete body.id;
  await settingsDB.read();
  _.mergeWith(settingsDB.data, body, replaceTapConfig);
  await settingsDB.write();
  res.status(200).json(settingsDB.data);
});


export default router;
