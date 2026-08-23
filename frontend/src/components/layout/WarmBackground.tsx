"use client";

export function WarmBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute rounded-full animate-float-slow"
        style={{
          top: "-15%", right: "-10%",
          height: "700px", width: "700px",
          background: "radial-gradient(circle, var(--warm-orb-1) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute rounded-full animate-float-medium"
        style={{
          bottom: "-15%", left: "-10%",
          height: "700px", width: "700px",
          background: "radial-gradient(circle, var(--warm-orb-2) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute rounded-full animate-float-fast"
        style={{
          top: "30%", left: "35%",
          height: "400px", width: "400px",
          background: "radial-gradient(circle, var(--warm-orb-3) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}
