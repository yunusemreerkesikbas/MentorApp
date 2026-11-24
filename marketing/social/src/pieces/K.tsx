// "İşe yarar" carousels: five cards each, one saveable study routine (spec docs/plans/2026-11-15-social-growth-strategy-design.md).
import { TipCard } from "../components/Tip";
import { COPY } from "../copy";
import type { PieceProps } from "../pieces";

export const K1 = ({ card = 1, safe }: PieceProps) => <TipCard copy={COPY.K1!} card={card} safe={safe} />;
export const K2 = ({ card = 1, safe }: PieceProps) => <TipCard copy={COPY.K2!} card={card} safe={safe} />;
