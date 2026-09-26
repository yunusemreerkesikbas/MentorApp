"use client";

import { useState } from "react";
import { DigitPopIn } from "@mentor/ui";

/**
 * A count that pops when the coach's own action changes it (`.coach-count` pace); the number the
 * screen opened with stays still. Its heading carries the whole sentence as `aria-label`: digits
 * split into boxes can be read apart ("1 2"), and a hidden second copy would double the text.
 */
export function CountPop({ value }: { value: number }) {
  const [opened] = useState(value);
  const [live, setLive] = useState(false);
  if (!live && value !== opened) setLive(true);
  return live ? <DigitPopIn value={value} className="coach-count" /> : <>{value}</>;
}
