// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="7b512ee8-1d7a-5769-a26e-0914fd2bd0fb")}catch(e){}}();
import { z } from 'zod';
export const MIN_TARGET_TEMPERATURE_F = 55;
export const MAX_TARGET_TEMPERATURE_F = 110;
const SideStatusSchema = z.object({
    currentTemperatureLevel: z.number(),
    currentTemperatureF: z.number(),
    targetTemperatureF: z.number()
        .min(MIN_TARGET_TEMPERATURE_F, { message: `Temperature must be at least ${MIN_TARGET_TEMPERATURE_F}°F` })
        .max(MAX_TARGET_TEMPERATURE_F, { message: `Temperature cannot exceed ${MAX_TARGET_TEMPERATURE_F}°F` }),
    secondsRemaining: z.number(),
    isOn: z.boolean(),
    isAlarmVibrating: z.boolean(),
    taps: z.object({
        doubleTap: z.number(),
        tripleTap: z.number(),
        quadTap: z.number(),
    }).optional(),
}).strict();
export const DeviceStatusSchema = z.object({
    left: SideStatusSchema,
    right: SideStatusSchema,
    waterLevel: z.string(),
    isPriming: z.boolean(),
    settings: z.object({
        v: z.number(),
        gainLeft: z.number(),
        gainRight: z.number(),
        ledBrightness: z.number(),
    }),
    coverVersion: z.string(),
    hubVersion: z.string(),
    freeSleep: z.object({
        version: z.string(),
        branch: z.string(),
    }),
    wifiStrength: z.number(),
}).strict();
export var Version;
(function (Version) {
    Version["NotFound"] = "Version not found";
    Version["Pod3"] = "Pod 3";
    Version["Pod4"] = "Pod 4";
    Version["Pod5"] = "Pod 5";
})(Version || (Version = {}));
//# sourceMappingURL=deviceStatusSchema.js.map
//# debugId=7b512ee8-1d7a-5769-a26e-0914fd2bd0fb
