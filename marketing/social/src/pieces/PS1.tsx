import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY, PREMIUM_SALE_OPEN } from "../copy";
import { Frame } from "../components/Frame";
import { PremiumTopBar, Sticker } from "../components/Premium";
import type { PieceProps } from "../pieces";
import { Beam, HeroFloor, HeroToggle, HeroType } from "./PF1";

const T = COPY.PS1!;

// PF1 stretched to 9:16 inside the story safe band (y 250–1670). Stories vanish in 24 h, so ÇOK YAKINDA stays.
export function PS1({ safe }: PieceProps) {
  return (
    <Frame format="story" background={C.cream} color={C.mask} safe={safe}>
      <Beam points={[[366, 744], [540, 744], [1010, 1560], [100, 1560]]} />
      <PremiumTopBar top={270} ink={C.mask} label={T.pill} logoSize={48} />
      <HeroType top={372} head1={T.head1} head2={T.head2} />
      <HeroToggle label={T.toggle} top={794} />
      <div style={{ position: "absolute", left: 50, top: 790 }}>
        <Sticker text={PREMIUM_SALE_OPEN ? T.trial : T.badge} shadow={C.mask} />
      </div>
      <Img src={staticFile(ART.premiumHero)} alt={T.altPuhu} style={{ position: "absolute", left: 30, top: 856, width: 1000, height: 714, objectFit: "contain" }} />
      <HeroFloor top={1556} textTop={1584} line1={T.line1} line2={T.line2} sizes={[40, 28]} />
    </Frame>
  );
}
