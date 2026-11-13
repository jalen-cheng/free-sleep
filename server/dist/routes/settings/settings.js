
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="7d20c6e1-2bde-5f23-b07f-62e8b06dc0b4")}catch(e){}}();
import _ from 'lodash';
import express from 'express';
import logger from '../../logger.js';
const router = express.Router();
import settingsDB from '../../db/settings.js';
import { SettingsSchema, TapConfig } from '../../db/settingsSchema.js';
// Tap configs are one of two shapes picked by `type`. Replace them as a whole instead of merging,
// so switching type does not leave the other shape's fields behind in settingsDB.json.
const replaceTapConfig = (_existingValue, newValue) => {
    if (TapConfig.safeParse(newValue).success)
        return newValue;
    return undefined;
};
router.get('/settings', async (req, res) => {
    await settingsDB.read();
    res.json(settingsDB.data);
});
router.post('/settings', async (req, res) => {
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
//# sourceMappingURL=settings.js.map
//# debugId=7d20c6e1-2bde-5f23-b07f-62e8b06dc0b4
