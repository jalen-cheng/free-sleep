// Pure helpers that turn lines of the Pod 5 firmware log into button presses.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
//
// A Pod 5 cover has three buttons per side. The firmware does not report them through the tap
// counters in its status reply; it writes each press to its own log, for example:
//   ... [buttons] middle button held for 2140ms
//   ... DBG:1234 ... [TTC] processing [button] side left { button: middle, type: short ...
// The line formats were first worked out in github.com/seanpasino/free-sleep.
import type { SideSettings } from '../db/settingsSchema.js';

type Side = 'left' | 'right';
type Gesture = keyof SideSettings['taps'];
export type Button = 'top' | 'bottom' | 'middle';

export type ButtonPress = {
  side: Side;
  button: Button;
  // Only known for the middle button, and only when the firmware reported it just before the press
  heldMs?: number;
};

const PRESS_PATTERN = /\[TTC\] processing \[button\] side (left|right) \{ button: (top|bottom|middle)\b/;
// Reported on its own line, without a side, just before the middle press it belongs to
const MIDDLE_HELD_PATTERN = /\[buttons\] middle button held for (\d+)ms/;
// A hold duration older than this belongs to some earlier press
const HELD_LINE_MAX_AGE_MS = 4_000;

// Holding the middle button at least this long switches the side on or off
export const POWER_HOLD_MS = 2_000;

// Each button uses the settings of the tap gesture that does the same job on a Pod 4:
// "-" cools like a double tap, "+" warms like a triple tap, the middle button is the quadruple tap.
export const BUTTON_GESTURES: Record<Button, Gesture> = {
  bottom: 'doubleTap',
  top: 'tripleTap',
  middle: 'quadTap',
};

// Returns a function that is fed the firmware log one line at a time and returns a press when a
// line completes one. It keeps the last "held for" duration to attach to the next middle press.
export function createButtonLineParser(getNowMs: () => number = Date.now) {
  let lastHeldMs: number | undefined;
  let lastHeldAtMs = 0;

  return (line: string): ButtonPress | null => {
    const heldMatch = MIDDLE_HELD_PATTERN.exec(line);
    if (heldMatch) {
      lastHeldMs = Number(heldMatch[1]);
      lastHeldAtMs = getNowMs();
      return null;
    }

    const pressMatch = PRESS_PATTERN.exec(line);
    if (!pressMatch) return null;
    const press: ButtonPress = { side: pressMatch[1] as Side, button: pressMatch[2] as Button };
    if (press.button === 'middle') {
      const isHeldFresh = lastHeldMs !== undefined && getNowMs() - lastHeldAtMs <= HELD_LINE_MAX_AGE_MS;
      if (isHeldFresh) press.heldMs = lastHeldMs;
      lastHeldMs = undefined;
    }
    return press;
  };
}

// True for a middle press held long enough to mean "switch this side on or off"
export function isPowerHold(press: ButtonPress): boolean {
  return press.button === 'middle' && (press.heldMs ?? 0) >= POWER_HOLD_MS;
}

// Counts one side's presses per gesture, in the shape the tap gesture code already works with.
// Power holds are left out; the caller handles those separately.
export function countPressesAsGestures(presses: ButtonPress[]): Partial<Record<Gesture, number>> {
  const gestureCounts: Partial<Record<Gesture, number>> = {};
  for (const press of presses) {
    if (isPowerHold(press)) continue;
    const gesture = BUTTON_GESTURES[press.button];
    gestureCounts[gesture] = (gestureCounts[gesture] ?? 0) + 1;
  }
  return gestureCounts;
}
