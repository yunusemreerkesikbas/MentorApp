import { C } from "../brand";
import { COPY, PREMIUM_SALE_OPEN } from "../copy";
import { Frame } from "../components/Frame";
import { PremiumTopBar, Sticker } from "../components/Premium";
import type { PieceProps } from "../pieces";
import { CometTail, FlightPuhu, PelerinHead, Sky, type Star } from "./PF2";

const T = COPY.PS2!;

const STARS: Star[] = [
  { x: 930, y: 380, size: 40 },
  { x: 870, y: 610, size: 22, gold: true },
  { x: 96, y: 820, size: 30 },
  { x: 990, y: 1320, size: 34 },
  { x: 660, y: 1700, size: 20, gold: true },
];

// PF2 at 9:16 inside the story safe band (y 250–1670). Stories vanish in 24 h, so ÇOK YAKINDA stays.
export function PS2({ safe }: PieceProps) {
  return (
    <Frame format="story" background={C.flight} safe={safe}>
      <Sky stars={STARS} />
      <FlightPuhu left={60} top={650} size={1060} alt={T.altPuhu} />
      <CometTail left={60} top={650} size={1060} />
      <PremiumTopBar top={270} ink="#FFFFFF" label={T.pill} ring logoSize={48} />
      <PelerinHead top={384} head1={T.head1} head2={T.head2} body={T.body} />
      <div style={{ position: "absolute", right: 56, top: 1580 }}>
        <Sticker text={PREMIUM_SALE_OPEN ? T.trial : T.badge} shadow={C.gold} style={{ fontSize: 30, padding: "18px 34px" }} />
      </div>
    </Frame>
  );
}
