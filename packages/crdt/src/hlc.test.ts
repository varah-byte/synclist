import { describe, it, expect } from "vitest";
import { compareHlc, tickHlc, receiveHlc } from "./hlc";

describe("compareHlc", () => {
  it("higher counter wins when wall is equal", () => {
    expect(compareHlc({ wall: 500, counter: 2 }, { wall: 500, counter: 3 })).toBeLessThan(0);
  });
  it("higher wall wins regardless of counter", () => {
    expect(compareHlc({ wall: 499, counter: 9 }, { wall: 500, counter: 0 })).toBeLessThan(0);
  });
  it("equal returns 0", () => {
    expect(compareHlc({ wall: 500, counter: 3 }, { wall: 500, counter: 3 })).toBe(0);
  });
  it("newer wall is positive", () => {
    expect(compareHlc({ wall: 501, counter: 0 }, { wall: 500, counter: 9 })).toBeGreaterThan(0);
  });
});

describe("tickHlc", () => {
  it("bumps counter when the clock has not moved", () => {
    expect(tickHlc({ wall: 1000, counter: 4 }, 1000)).toEqual({ wall: 1000, counter: 5 });
  });
  it("never goes backwards if the clock does", () => {
    expect(tickHlc({ wall: 1000, counter: 2 }, 900)).toEqual({ wall: 1000, counter: 3 });
  });
  it("resets counter when time moves forward", () => {
    expect(tickHlc({ wall: 1000, counter: 2 }, 1005)).toEqual({ wall: 1005, counter: 0 });
  });
});

describe("receiveHlc", () => {
  it("result is bigger than both clocks", () => {
    const last = { wall: 1000, counter: 1 };
    const remote = { wall: 1000, counter: 5 };
    const r = receiveHlc(last, remote, 900);
    expect(compareHlc(r, last)).toBeGreaterThan(0);
    expect(compareHlc(r, remote)).toBeGreaterThan(0);
  });
  it("pulls a slow clock forward to the remote", () => {
    expect(receiveHlc({ wall: 500, counter: 0 }, { wall: 2000, counter: 3 }, 600))
      .toEqual({ wall: 2000, counter: 4 });
  });
});