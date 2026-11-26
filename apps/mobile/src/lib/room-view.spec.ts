import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roomInviteLink, seatLabel, seatPositions, stepRoomTheme } from "./room-view.ts";

describe("room view", () => {
  it("places the first seat at 12 o'clock and spaces seats evenly on a circle", () => {
    assert.deepEqual(seatPositions(0), []);
    const four = seatPositions(4, { rx: 30, ry: 30 }).map((p) => [Math.round(p.leftPct), Math.round(p.topPct)]);
    assert.deepEqual(four, [[50, 20], [80, 50], [50, 80], [20, 50]]);
  });

  it("keeps every seat on the ellipse", () => {
    for (const p of seatPositions(7, { rx: 36, ry: 34, yScale: 4 / 3 })) {
      const v = ((p.leftPct - 50) / 36) ** 2 + ((p.topPct - 50) / 34) ** 2;
      assert.ok(Math.abs(v - 1) < 0.01);
    }
  });

  it("steps themes in a loop, shortens names and builds the web invite link", () => {
    assert.equal(stepRoomTheme("HOME", 1), "LIBRARY");
    assert.equal(stepRoomTheme("LIBRARY", -1), "HOME");
    assert.equal(seatLabel("Ayşe Nur Kaya"), "Ayşe K.");
    assert.equal(seatLabel("Selin"), "Selin");
    assert.equal(roomInviteLink("MASA-A1B2C3", "tr"), "https://puhukoc.com/masaya-katil?kod=MASA-A1B2C3");
    assert.equal(roomInviteLink("MASA-A1B2C3", "en"), "https://puhukoc.com/en/join-room?kod=MASA-A1B2C3");
  });
});
