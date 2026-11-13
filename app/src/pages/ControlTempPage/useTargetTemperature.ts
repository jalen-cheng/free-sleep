import _ from 'lodash';
import { useCallback, useEffect, useRef } from 'react';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useAppStore } from '@state/appStore.tsx';
import { MAX_TEMP_F, MIN_TEMP_F } from '@lib/temperatureConversions.ts';
import { useControlTempStore } from './controlTempStore.tsx';

// How long to wait after the last +/- press before sending, so a run of presses is one request
const COMMIT_DELAY_MS = 700;
// The Pod takes a moment to report a new target back
const STATUS_SETTLE_MS = 1_500;

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

// Edits the selected side's target temperature.
// Changes show on screen at once and are sent to the Pod separately, so the controls never
// lock up while a request is in flight. While an edit is pending, the page does not overwrite
// it with older values polled from the Pod (see `hasPendingEdit`).
export function useTargetTemperature(refetch: () => Promise<unknown>) {
  const { side } = useAppStore();
  const setDeviceStatus = useControlTempStore(state => state.setDeviceStatus);
  const setHasPendingEdit = useControlTempStore(state => state.setHasPendingEdit);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Counts edits, so a slow request can tell that a newer edit has replaced it
  const editCount = useRef(0);

  // Shows a new target on screen without sending it. Returns the clamped value.
  const previewTargetTemperature = useCallback((temperatureF: number) => {
    const targetTemperatureF = _.clamp(Math.round(temperatureF), MIN_TEMP_F, MAX_TEMP_F);
    const currentTarget = useControlTempStore.getState().deviceStatus?.[side]?.targetTemperatureF;
    if (targetTemperatureF === currentTarget) return targetTemperatureF;
    editCount.current += 1;
    setHasPendingEdit(true);
    setDeviceStatus({ [side]: { targetTemperatureF } });
    return targetTemperatureF;
  }, [side, setDeviceStatus, setHasPendingEdit]);

  // Sends the target shown on screen to the Pod, then reloads the Pod's state
  const commitTargetTemperature = useCallback(async () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    const targetTemperatureF = useControlTempStore.getState().deviceStatus?.[side]?.targetTemperatureF;
    if (targetTemperatureF === undefined) return;
    const editCountAtCommit = editCount.current;
    try {
      await postDeviceStatus({ [side]: { targetTemperatureF } });
      await wait(STATUS_SETTLE_MS);
    } catch (error) {
      console.error(error);
    }
    // A newer edit is on screen and will send itself; reloading now would undo it
    if (editCount.current !== editCountAtCommit) return;
    // Reload before releasing the edit, so the screen never falls back to the old value in between
    await refetch();
    if (editCount.current === editCountAtCommit) setHasPendingEdit(false);
  }, [side, refetch, setHasPendingEdit]);

  // Moves the target by a number of °F and sends it once the presses stop
  const stepTargetTemperature = useCallback((changeF: number) => {
    const currentTarget = useControlTempStore.getState().deviceStatus?.[side]?.targetTemperatureF;
    if (currentTarget === undefined) return;
    previewTargetTemperature(currentTarget + changeF);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => void commitTargetTemperature(), COMMIT_DELAY_MS);
  }, [side, previewTargetTemperature, commitTargetTemperature]);

  // Switching side or leaving the page sends a waiting change right away instead of dropping it
  useEffect(() => () => {
    if (commitTimer.current) void commitTargetTemperature();
  }, [commitTargetTemperature]);

  return { previewTargetTemperature, commitTargetTemperature, stepTargetTemperature };
}
