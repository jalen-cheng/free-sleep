
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="dd2f4c53-7763-5f03-b897-347e3e9e3d2d")}catch(e){}}();
import express from 'express';
import { connectFranken } from '../../8sleep/frankenServer.js';
import { DeviceStatusSchema } from './deviceStatusSchema.js';
import logger from '../../logger.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';
const router = express.Router();
router.get('/deviceStatus', async (req, res) => {
    const franken = await connectFranken();
    const resp = await franken.getDeviceStatus();
    res.json(resp);
});
// Debugging aid: the firmware's unparsed status text, to see what a Pod reports beyond what Free Sleep reads
router.get('/deviceStatus/raw', async (req, res) => {
    const franken = await connectFranken();
    res.type('text/plain').send(await franken.getRawDeviceStatus());
});
router.post('/deviceStatus', async (req, res) => {
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
    await updateDeviceStatus(body);
    res.status(204).end();
});
export default router;
//# sourceMappingURL=deviceStatus.js.map
//# debugId=dd2f4c53-7763-5f03-b897-347e3e9e3d2d
