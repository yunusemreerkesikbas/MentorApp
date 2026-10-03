/**
 * What else lives on the desk: a mug still steaming, a plant by the window, a pencil left lying.
 *
 * Nothing here is interactive or announced. They are there so the notebooks lie on somebody's desk
 * rather than on a textured background, and they only appear where the desk has room for them.
 */

export function DeskMug({ className }: { className?: string }) {
  return (
    <svg
      className={`desk-prop desk-mug ${className ?? ""}`}
      width="130"
      height="150"
      viewBox="0 0 130 150"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <ellipse cx="60" cy="145" rx="56" ry="7" fill="#000" opacity="0.4" style={{ filter: "blur(5px)" }} />
      <path className="desk-steam" d="M44 40 C 36 26, 52 18, 44 4" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path className="desk-steam" d="M62 42 C 54 24, 72 16, 62 0" strokeWidth="5" fill="none" strokeLinecap="round" style={{ animationDelay: "1.25s" }} />
      <path className="desk-steam" d="M80 40 C 72 28, 88 20, 80 6" strokeWidth="5" fill="none" strokeLinecap="round" style={{ animationDelay: "2.5s" }} />
      <path className="handle" d="M100 74 C 128 74, 128 118, 98 118" strokeWidth="11" fill="none" />
      <path className="body" d="M12 54 L104 54 L98 134 Q96 142 86 142 L30 142 Q20 142 18 134 Z" />
      <path d="M16 88 L101 88 L100 102 L17 102 Z" fill="#55acee" opacity="0.6" />
      <ellipse className="rim" cx="58" cy="54" rx="46" ry="9" />
      <ellipse cx="58" cy="55" rx="40" ry="6.5" fill="#3a2316" />
      <path d="M26 62 L30 132" stroke="#fff" strokeOpacity="0.38" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function DeskPlant({ className }: { className?: string }) {
  return (
    <svg
      className={`desk-prop ${className ?? ""}`}
      width="150"
      height="200"
      viewBox="0 0 150 200"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <ellipse cx="75" cy="194" rx="58" ry="8" fill="#000" opacity="0.4" style={{ filter: "blur(5px)" }} />
      <path d="M70 132 C 52 92, 50 46, 62 8 C 74 46, 82 92, 80 132 Z" fill="#3f6f4f" />
      <path d="M76 132 C 82 96, 96 62, 122 36 C 114 72, 100 104, 86 134 Z" fill="#5c8f63" />
      <path d="M72 134 C 60 108, 40 86, 14 72 C 28 100, 46 122, 66 138 Z" fill="#4c7f58" />
      <path d="M74 134 C 70 104, 74 74, 90 50 C 92 80, 88 108, 82 136 Z" fill="#78a875" />
      <path d="M66 60 C 64 44, 64 30, 66 20" stroke="#a8d0a0" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M30 132 L120 132 L110 192 Q108 198 100 198 L50 198 Q42 198 40 192 Z" fill="#b4623e" />
      <rect x="26" y="126" width="98" height="16" rx="4" fill="#c9764e" />
      <path d="M40 146 L44 188" stroke="#fff" strokeOpacity="0.18" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** A pencil lying on the wood, drawn flat and tilted into the desk's own perspective. */
export function DeskPencil({ className }: { className?: string }) {
  return (
    <div
      className={`desk-prop ${className ?? ""}`}
      aria-hidden="true"
      style={{
        width: 240,
        height: 16,
        transform: "perspective(900px) rotateX(46deg) rotateZ(-14deg)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 8,
          background: "#000",
          opacity: 0.45,
          filter: "blur(5px)",
          transform: "translate(6px, 8px)",
        }}
      />
      <div style={{ position: "absolute", left: 0, top: 0, width: 20, height: 16, borderRadius: "6px 0 0 6px", background: "linear-gradient(180deg,#f6a5a5,#e07a7a 50%,#b85c5c)" }} />
      <div style={{ position: "absolute", left: 18, top: -1, width: 18, height: 18, borderRadius: 2, background: "linear-gradient(180deg,#eef0f3,#aeb4bf 45%,#7b818c)" }} />
      <div style={{ position: "absolute", left: 35, top: 0, width: 164, height: 16, background: "linear-gradient(180deg,#ffe08a,#f2b733 40%,#d99a1f 70%,#a8721a)" }} />
      <div style={{ position: "absolute", left: 198, top: 0, width: 34, height: 16, background: "linear-gradient(180deg,#f3d7ae,#e2bd8a 50%,#c99c66)", clipPath: "polygon(0 0,100% 42%,100% 58%,0 100%)" }} />
      <div style={{ position: "absolute", left: 223, top: 5.5, width: 13, height: 5, background: "#2b2b30", clipPath: "polygon(0 0,100% 50%,0 100%)" }} />
    </div>
  );
}
