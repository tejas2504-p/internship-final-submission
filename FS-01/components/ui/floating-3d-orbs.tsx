"use client";

import * as React from "react";

interface Floating3DOrbsProps {
  className?: string;
  intensity?: "subtle" | "medium" | "high";
}

export function Floating3DOrbs({ className = "", intensity = "medium" }: Floating3DOrbsProps) {
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse coordinates (-1 to 1)
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const mult = intensity === "subtle" ? 0.5 : intensity === "high" ? 1.5 : 1;
  const parallax = (factor: number) => ({
    transform: `translate3d(${mousePos.x * factor * mult}px, ${mousePos.y * factor * mult}px, 0)`,
    transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
  });

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none -z-10 ${className}`}
      aria-hidden="true"
    >
      {/* Ambient background pastel light blue glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-gradient-to-tr from-sky-200/20 via-blue-100/15 to-indigo-100/20 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/3 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-sky-100/20 via-cyan-100/15 to-transparent blur-[140px] rounded-full pointer-events-none" />

      {/* Top Left Major 3D Fluid Sphere */}
      <div
        style={parallax(28)}
        className="absolute -top-16 -left-20 sm:-top-24 sm:-left-24 w-64 h-64 sm:w-96 sm:h-96 rounded-full animate-float-slow opacity-90"
      >
        <div
          className="w-full h-full rounded-full shadow-[0_20px_60px_rgba(14,165,233,0.12)]"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, #ffffff 0%, #f0f9ff 35%, #e0f2fe 70%, #bae6fd 100%)",
            boxShadow:
              "inset -16px -16px 40px rgba(14, 165, 233, 0.22), inset -6px -6px 15px rgba(2, 132, 199, 0.15), inset 12px 12px 28px rgba(255, 255, 255, 0.9), 0 20px 45px rgba(14, 165, 233, 0.12)",
          }}
        >
          {/* Specular high-gloss sheen reflection */}
          <div className="absolute top-8 left-12 w-20 h-10 rounded-full bg-gradient-to-b from-white/90 to-transparent rotate-[-30deg] blur-[1px]" />
        </div>
      </div>

      {/* Top Right Floating Sphere */}
      <div
        style={parallax(-20)}
        className="absolute top-24 -right-16 sm:top-16 sm:-right-20 w-48 h-48 sm:w-80 sm:h-80 rounded-full animate-float-reverse opacity-85"
      >
        <div
          className="w-full h-full rounded-full shadow-[0_20px_50px_rgba(56,189,248,0.12)]"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #ffffff 0%, #f8fafc 40%, #f0f9ff 75%, #e0f2fe 100%)",
            boxShadow:
              "inset 16px 16px 36px rgba(56, 189, 248, 0.2), inset 6px 6px 15px rgba(14, 165, 233, 0.15), inset -10px -10px 25px rgba(255, 255, 255, 0.9), 0 18px 40px rgba(14, 165, 233, 0.12)",
          }}
        >
          <div className="absolute top-6 left-10 w-16 h-8 rounded-full bg-gradient-to-b from-white/90 to-transparent rotate-[-25deg] blur-[1px]" />
        </div>
      </div>

      {/* Mid Left Accent Orb */}
      <div
        style={parallax(40)}
        className="absolute top-1/2 -left-12 sm:top-[45%] sm:left-4 w-32 h-32 sm:w-44 sm:h-44 rounded-full animate-float-medium opacity-85"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #ffffff 0%, #fff1f2 45%, #ffe4e6 85%)",
            boxShadow:
              "inset -10px -10px 25px rgba(244, 63, 94, 0.25), inset 8px 8px 18px rgba(255, 255, 255, 0.9), 0 12px 30px rgba(244, 63, 94, 0.12)",
          }}
        />
      </div>

      {/* Bottom Floating Bubble */}
      <div
        style={parallax(-32)}
        className="absolute bottom-16 right-8 sm:bottom-28 sm:right-24 w-36 h-36 sm:w-56 sm:h-56 rounded-full animate-float-slow opacity-85"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 34% 28%, #ffffff 0%, #f0f9ff 42%, #e0f2fe 85%)",
            boxShadow:
              "inset -14px -14px 30px rgba(14, 165, 233, 0.22), inset 10px 10px 20px rgba(255, 255, 255, 0.9), 0 15px 35px rgba(14, 165, 233, 0.12)",
          }}
        >
          <div className="absolute top-4 left-6 w-10 h-5 rounded-full bg-gradient-to-b from-white/90 to-transparent rotate-[-35deg] blur-[1px]" />
        </div>
      </div>
    </div>
  );
}
