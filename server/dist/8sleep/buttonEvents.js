
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="90063d81-688d-5ba9-943b-c43f95f9427e")}catch(e){}}();
const PRESS_PATTERN = /\[TTC\] processing \[button\] side (left|right) \{ button: (top|bottom|middle)\b/;
// Reported on its own line, without a side, just before the middle press it belongs to
const MIDDLE_HELD_PATTERN = /\[buttons\] middle button held for (\d+)ms/;
// A hold duration older than this belongs to some earlier press
const HELD_LINE_MAX_AGE_MS = 4_000;
// Holding the middle button at least this long switches the side on or off
export const POWER_HOLD_MS = 2_000;
// Each button uses the settings of the tap gesture that does the same job on a Pod 4:
// "-" cools like a double tap, "+" warms like a triple tap, the middle button is the quadruple tap.
export const BUTTON_GESTURES = {
    bottom: 'doubleTap',
    top: 'tripleTap',
    middle: 'quadTap',
};
// Returns a function that is fed the firmware log one line at a time and returns a press when a
// line completes one. It keeps the last "held for" duration to attach to the next middle press.
export function createButtonLineParser(getNowMs = Date.now) {
    let lastHeldMs;
    let lastHeldAtMs = 0;
    return (line) => {
        const heldMatch = MIDDLE_HELD_PATTERN.exec(line);
        if (heldMatch) {
            lastHeldMs = Number(heldMatch[1]);
            lastHeldAtMs = getNowMs();
            return null;
        }
        const pressMatch = PRESS_PATTERN.exec(line);
        if (!pressMatch)
            return null;
        const press = { side: pressMatch[1], button: pressMatch[2] };
        if (press.button === 'middle') {
            const isHeldFresh = lastHeldMs !== undefined && getNowMs() - lastHeldAtMs <= HELD_LINE_MAX_AGE_MS;
            if (isHeldFresh)
                press.heldMs = lastHeldMs;
            lastHeldMs = undefined;
        }
        return press;
    };
}
// True for a middle press held long enough to mean "switch this side on or off"
export function isPowerHold(press) {
    return press.button === 'middle' && (press.heldMs ?? 0) >= POWER_HOLD_MS;
}
// Counts one side's presses per gesture, in the shape the tap gesture code already works with.
// Power holds are left out; the caller handles those separately.
export function countPressesAsGestures(presses) {
    const gestureCounts = {};
    for (const press of presses) {
        if (isPowerHold(press))
            continue;
        const gesture = BUTTON_GESTURES[press.button];
        gestureCounts[gesture] = (gestureCounts[gesture] ?? 0) + 1;
    }
    return gestureCounts;
}
//# sourceMappingURL=buttonEvents.js.map
//# debugId=90063d81-688d-5ba9-943b-c43f95f9427e
