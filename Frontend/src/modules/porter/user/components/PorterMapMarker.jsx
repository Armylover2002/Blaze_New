import React from "react";

/**
 * Fixed center pin used by the immersive location picker.
 * The map moves underneath; this pin stays visually centered.
 * `moving` triggers a lift/bounce while the camera is in motion.
 */
export function CenterPin({ moving = false, label, color = "#2563EB" }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div
        className="relative flex flex-col items-center"
        style={{
          transform: moving ? "translateY(-10px)" : "translateY(0)",
          transition: "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {label && (
          <div className="mb-1 whitespace-nowrap rounded-full bg-gray-900/90 px-3 py-1 text-[11px] font-bold text-white shadow-lg">
            {label}
          </div>
        )}

        <svg width="46" height="56" viewBox="0 0 46 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.25))" }}>
          <path
            d="M23 2C12.5 2 4 10.4 4 20.8C4 33.5 19.4 49.3 22 51.9C22.6 52.5 23.4 52.5 24 51.9C26.6 49.3 42 33.5 42 20.8C42 10.4 33.5 2 23 2Z"
            fill={color}
          />
          <path
            d="M23 2C12.5 2 4 10.4 4 20.8C4 33.5 19.4 49.3 22 51.9C22.6 52.5 23.4 52.5 24 51.9C26.6 49.3 42 33.5 42 20.8C42 10.4 33.5 2 23 2Z"
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          <circle cx="23" cy="20.5" r="8.5" fill="#ffffff" />
          <circle cx="23" cy="20.5" r="4" fill={color} />
        </svg>

        {/* Ground shadow that shrinks when the pin lifts */}
        <span
          className="mt-[-2px] block rounded-full bg-black/30"
          style={{
            width: moving ? 10 : 14,
            height: moving ? 3 : 5,
            opacity: moving ? 0.35 : 0.5,
            transition: "all 200ms ease",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Returns a custom Blaze SVG icon for google.maps.Marker (route map pickup/drop).
 * Must be called only after Google Maps has loaded.
 */
export function blazeMarkerIcon(color = "#2563EB") {
  const svg = `
    <svg width="40" height="50" viewBox="0 0 46 56" xmlns="http://www.w3.org/2000/svg">
      <path d="M23 2C12.5 2 4 10.4 4 20.8C4 33.5 19.4 49.3 22 51.9C22.6 52.5 23.4 52.5 24 51.9C26.6 49.3 42 33.5 42 20.8C42 10.4 33.5 2 23 2Z" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="23" cy="20.5" r="8.5" fill="#ffffff"/>
      <circle cx="23" cy="20.5" r="4" fill="${color}"/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(40, 50),
    anchor: new window.google.maps.Point(20, 48),
  };
}

export const PICKUP_COLOR = "#2e7d32";
export const DROP_COLOR = "#2563EB";
