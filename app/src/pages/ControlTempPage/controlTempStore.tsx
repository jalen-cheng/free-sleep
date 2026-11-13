import _ from 'lodash';
import { create } from 'zustand';
import { DeepPartial } from 'ts-essentials';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';


type ControlTempStore = {
  deviceStatus: DeviceStatus | undefined;
  setDeviceStatus: (newDeviceStatus: DeepPartial<DeviceStatus>) => void;
  // True while a temperature change is on screen that the Pod has not confirmed yet
  hasPendingEdit: boolean;
  setHasPendingEdit: (hasPendingEdit: boolean) => void;
};

export const useControlTempStore = create<ControlTempStore>((set, get) => ({
  deviceStatus: undefined,
  setDeviceStatus: (newDeviceStatus) => {
    const { deviceStatus } = get();
    // Merge into a new object: components that select `deviceStatus` only re-render when it is replaced
    const updatedDeviceStatus = _.merge({}, deviceStatus, newDeviceStatus);
    set({ deviceStatus: updatedDeviceStatus });
  },
  hasPendingEdit: false,
  setHasPendingEdit: (hasPendingEdit) => set({ hasPendingEdit }),
}));
