import { describe, it, expect } from "vitest";
import {
  resolveEffectiveCity,
  isFriendInMyCity,
} from "./effectiveCity";

const TODAY = "2026-04-22";

describe("resolveEffectiveCity", () => {
  it("falls back to home address when no availability row exists", () => {
    expect(
      resolveEffectiveCity({
        date: TODAY,
        availability: [],
        homeAddress: "Frisco, TX",
      }),
    ).toBe("dallas");
  });

  it("uses trip_location when availability is away", () => {
    expect(
      resolveEffectiveCity({
        date: TODAY,
        availability: [
          {
            date: TODAY,
            location_status: "away",
            trip_location: "Dallas",
          },
        ],
        homeAddress: "New York, NY",
      }),
    ).toBe("dallas");
  });

  it("uses home address when availability for the date is home", () => {
    expect(
      resolveEffectiveCity({
        date: TODAY,
        availability: [
          { date: TODAY, location_status: "home", trip_location: null },
        ],
        homeAddress: "Boston, MA",
      }),
    ).toBe("boston");
  });

  it("ignores availability rows for other dates", () => {
    expect(
      resolveEffectiveCity({
        date: TODAY,
        availability: [
          {
            date: "2026-04-21",
            location_status: "away",
            trip_location: "Paris",
          },
        ],
        homeAddress: "Boston, MA",
      }),
    ).toBe("boston");
  });

  it("returns empty string when nothing resolves", () => {
    expect(
      resolveEffectiveCity({
        date: TODAY,
        availability: null,
        homeAddress: null,
      }),
    ).toBe("");
  });

  it("accepts a single availability row directly", () => {
    expect(
      resolveEffectiveCity({
        date: TODAY,
        availability: { location_status: "away", trip_location: "ATX" },
        homeAddress: "Boston, MA",
      }),
    ).toBe("austin");
  });
});

describe("isFriendInMyCity", () => {
  it("returns true when both resolve to the same metro", () => {
    expect(
      isFriendInMyCity({
        date: TODAY,
        myAvailability: [
          { date: TODAY, location_status: "away", trip_location: "Dallas" },
        ],
        myHomeAddress: "Frisco, TX",
        friendAvailability: [],
        friendHomeAddress: "Plano, TX",
      }),
    ).toBe(true);
  });

  it("returns false when friend is in a different city", () => {
    expect(
      isFriendInMyCity({
        date: TODAY,
        myAvailability: [
          { date: TODAY, location_status: "away", trip_location: "Dallas" },
        ],
        myHomeAddress: "Frisco, TX",
        friendAvailability: [],
        friendHomeAddress: "Boston, MA",
      }),
    ).toBe(false);
  });

  it("returns false when friend's city cannot be resolved", () => {
    expect(
      isFriendInMyCity({
        date: TODAY,
        myHomeAddress: "Frisco, TX",
        friendHomeAddress: null,
      }),
    ).toBe(false);
  });

  it("returns false when current user's city cannot be resolved", () => {
    expect(
      isFriendInMyCity({
        date: TODAY,
        myHomeAddress: null,
        friendHomeAddress: "Dallas, TX",
      }),
    ).toBe(false);
  });

  it("respects friend trips: friend traveling to my city counts as co-located", () => {
    expect(
      isFriendInMyCity({
        date: TODAY,
        myHomeAddress: "Dallas, TX",
        friendAvailability: [
          { date: TODAY, location_status: "away", trip_location: "Dallas" },
        ],
        friendHomeAddress: "New York, NY",
      }),
    ).toBe(true);
  });
});
