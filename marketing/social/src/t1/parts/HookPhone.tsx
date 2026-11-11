import { COPY } from "../../copy";
import { Phone } from "../../components/Phone";

const T = COPY.T1!;

// The "son bir video" the viewer is stuck on: a generic sunset clip (no platform UI) in the kit's 3D phone.
// Shared by scenes 01 and 02 so the phone does not move across the cut.
export function HookPhone({ progress, rotate = 0 }: { progress: number; rotate?: number }) {
  return (
    <Phone
      width={1000}
      screenBg="#111827"
      style={{ left: 60, top: 640, rotate: `${rotate}deg`, transformOrigin: "540px 700px", filter: "drop-shadow(0 -10px 50px rgba(0, 0, 0, 0.5))" }}
      screen={
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #2B1D5C 0%, #7A3A8C 38%, #E5677D 62%, #F6A55B 78%, #2A2348 100%)" }}>
          <div style={{ position: "absolute", left: 120, top: 300, width: 140, height: 140, borderRadius: "50%", background: "#FFD58A", boxShadow: "0 0 60px #FFC36B" }} />
          <div style={{ position: "absolute", left: -40, right: -40, top: 400, height: 220, borderRadius: "50% 50% 0 0", background: "#3B2E6B" }} />
          <div style={{ position: "absolute", left: 30, top: 14, fontSize: 17, fontWeight: 1000, color: "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>{T.clock}</div>
          <div style={{ position: "absolute", left: 20, right: 20, top: 520, height: 6, borderRadius: 3, background: "rgba(255, 255, 255, 0.3)" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 3, background: "#FFFFFF" }} />
          </div>
        </div>
      }
    />
  );
}
