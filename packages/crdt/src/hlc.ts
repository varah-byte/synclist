import type { Op } from "./types";

export type Hlc = Op["hlc"];

export function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall - b.wall;
  return a.counter - b.counter;
}

// Local event: user makes an edit
export function tickHlc(last: Hlc, now: number = Date.now()): Hlc {
  const wall = Math.max(now, last.wall);
  const counter = wall === last.wall ? last.counter + 1 : 0;
  return { wall, counter };
}

// Receiving a remote op
export function receiveHlc(
  last: Hlc,
  remote: Hlc,
  now: number = Date.now()
): Hlc {
  const wall = Math.max(now, last.wall, remote.wall);
  let counter: number;
  if (wall === last.wall && wall === remote.wall) {
    counter = Math.max(last.counter, remote.counter) + 1;
  } else if (wall === last.wall) {
    counter = last.counter + 1;
  } else if (wall === remote.wall) {
    counter = remote.counter + 1;
  } else {
    counter = 0;
  }
  return { wall, counter };
}