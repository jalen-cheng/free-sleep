import type { Side } from '@state/appStore.tsx';

export const getOtherSide = (side: Side): Side => (side === 'left' ? 'right' : 'left');

// The sides a change applies to: the selected side, plus the other one when the sides are linked
export const getControlledSides = (side: Side, linkSides: boolean): Side[] => {
  return linkSides ? [side, getOtherSide(side)] : [side];
};

// Builds an API payload that gives every listed side the same value, e.g. { left: value, right: value }
export const buildSidesPayload = <Value>(sides: Side[], value: Value): Partial<Record<Side, Value>> => {
  const payload: Partial<Record<Side, Value>> = {};
  sides.forEach(side => { payload[side] = value; });
  return payload;
};
