import { describe, expect, it } from "vitest";
import { assignSeats, seatForNewcomer, type SeatedLink } from "./seats";

const day = (n: number) => new Date(Date.UTC(2026, 8, n));

function link(id: string, acceptedDay: number, seat: SeatedLink["seat"], selfPaying = false): SeatedLink {
  return { id, acceptedAt: day(acceptedDay), seat, selfPaying };
}

const seatsOf = (result: Map<string, string>) => Object.fromEntries(result);

describe("assignSeats", () => {
  it("seats the oldest students first: free seats, then the plan's, then nobody", () => {
    const result = assignSeats(
      [link("d", 4, "NONE"), link("a", 1, "NONE"), link("c", 3, "NONE"), link("b", 2, "NONE")],
      { freeSeats: 2, paidSeats: 1 },
    );
    expect(seatsOf(result)).toEqual({ a: "FREE", b: "FREE", c: "PAID", d: "NONE" });
  });

  it("gives a student who pays for their own Premium no seat at all (one payer per student)", () => {
    const result = assignSeats(
      [link("a", 1, "FREE", true), link("b", 2, "NONE"), link("c", 3, "NONE")],
      { freeSeats: 2, paidSeats: 0 },
    );
    // `a` stopped holding the free seat the moment they paid; `b` and `c` share both free seats.
    expect(seatsOf(result)).toEqual({ a: "SELF", b: "FREE", c: "FREE" });
  });

  it("keeps a free seat already held when the free quota is lowered", () => {
    const result = assignSeats(
      [link("a", 1, "FREE"), link("b", 2, "FREE"), link("c", 3, "FREE"), link("d", 4, "NONE")],
      { freeSeats: 1, paidSeats: 0 },
    );
    expect(seatsOf(result)).toEqual({ a: "FREE", b: "FREE", c: "FREE", d: "NONE" });
  });

  it("freezes the newest paid students first when the coach's plan shrinks or ends", () => {
    const links = [
      link("f", 1, "FREE"),
      link("p1", 2, "PAID"),
      link("p2", 3, "PAID"),
      link("p3", 4, "PAID"),
    ];
    expect(seatsOf(assignSeats(links, { freeSeats: 1, paidSeats: 1 }))).toEqual({
      f: "FREE",
      p1: "PAID",
      p2: "NONE",
      p3: "NONE",
    });
    expect(seatsOf(assignSeats(links, { freeSeats: 1, paidSeats: 0 }))).toEqual({
      f: "FREE",
      p1: "NONE",
      p2: "NONE",
      p3: "NONE",
    });
  });

  it("brings frozen students back, oldest first, when seats return", () => {
    const result = assignSeats(
      [link("f", 1, "FREE"), link("w1", 2, "NONE"), link("w2", 3, "NONE"), link("w3", 4, "NONE")],
      { freeSeats: 1, paidSeats: 2 },
    );
    expect(seatsOf(result)).toEqual({ f: "FREE", w1: "PAID", w2: "PAID", w3: "NONE" });
  });

  it("moves a student whose own subscription ended back into a seat, or leaves them waiting", () => {
    const open = assignSeats([link("f", 1, "FREE"), link("s", 2, "SELF")], {
      freeSeats: 2,
      paidSeats: 0,
    });
    expect(seatsOf(open)).toEqual({ f: "FREE", s: "FREE" });

    const full = assignSeats([link("f", 1, "FREE"), link("s", 2, "SELF")], {
      freeSeats: 1,
      paidSeats: 0,
    });
    expect(seatsOf(full)).toEqual({ f: "FREE", s: "NONE" });
  });

  it("uses a free seat before a paid one, even for a student who held a paid seat", () => {
    // A free seat opened (quota raised); the paid student takes it, so a lapse can no longer freeze them.
    const result = assignSeats([link("f", 1, "FREE"), link("p", 2, "PAID")], {
      freeSeats: 2,
      paidSeats: 5,
    });
    expect(seatsOf(result)).toEqual({ f: "FREE", p: "FREE" });
  });

  it("seats a newcomer after everyone already linked, waiting students included", () => {
    const newcomer = { acceptedAt: day(9), selfPaying: false };
    // One free seat left over, but the student already waiting is older: they are owed it first.
    expect(
      seatForNewcomer([link("f", 1, "FREE"), link("w", 2, "NONE")], newcomer, {
        freeSeats: 2,
        paidSeats: 0,
      }),
    ).toBe("NONE");
    expect(
      seatForNewcomer([link("f", 1, "FREE")], newcomer, { freeSeats: 1, paidSeats: 1 }),
    ).toBe("PAID");
  });

  it("links a newcomer who pays for their own Premium even when every seat is taken", () => {
    expect(
      seatForNewcomer([link("f", 1, "FREE")], { acceptedAt: day(9), selfPaying: true }, {
        freeSeats: 1,
        paidSeats: 0,
      }),
    ).toBe("SELF");
  });

  it("breaks a tie on the acceptance time by id, so every caller gets the same answer", () => {
    const result = assignSeats([link("b", 1, "NONE"), link("a", 1, "NONE")], {
      freeSeats: 1,
      paidSeats: 0,
    });
    expect(seatsOf(result)).toEqual({ a: "FREE", b: "NONE" });
  });
});
