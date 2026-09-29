import React from "react";

/**
 * Geatsu Skeleton — premium pulsating loader to replace generic spinners
 * while AI models are "thinking" or data is in flight.
 *
 * Usage:
 *   <Skeleton width="60%" height={20} />
 *   <Skeleton.Block lines={3} />
 *   <Skeleton.Card />
 */
function SkeletonBase({ width = "100%", height = 14, radius = 6, className = "", style = {} }) {
  return (
    <>
      <span
        className={`geatsu-skel ${className}`}
        style={{
          width,
          height,
          borderRadius: radius,
          ...style,
        }}
      />
      <style>{`
        .geatsu-skel {
          display: block;
          background: linear-gradient(
            90deg,
            var(--bg-elevated) 0%,
            rgba(127, 127, 127, 0.18) 40%,
            var(--bg-elevated) 80%
          );
          background-size: 240px 100%;
          animation: geatsuShimmer 1.4s linear infinite;
          will-change: background-position;
        }
        [data-theme="dark"] .geatsu-skel {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 0%,
            rgba(255,255,255,0.10) 40%,
            rgba(255,255,255,0.04) 80%
          );
          background-size: 240px 100%;
        }
      `}</style>
    </>
  );
}

function Block({ lines = 3, gap = 10, lastWidth = "60%" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase key={i} width={i === lines - 1 ? lastWidth : "100%"} height={12} />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <SkeletonBase width="40%" height={14} />
      <SkeletonBase width="100%" height={28} radius={8} />
      <Block lines={3} />
    </div>
  );
}

SkeletonBase.Block = Block;
SkeletonBase.Card = CardSkeleton;

export default SkeletonBase;
