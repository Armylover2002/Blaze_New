import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";

// ─── Inner slide components memoize kiye — re-render sirf data change pe ──────
const FullWidthSlide = memo(({ banner, stepPercent, sectionTitle, eager }) => (
  <div
    className="relative shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center box-border h-[190px] rounded-none px-0"
    style={{ width: `${stepPercent}%` }}
  >
    <img
      src={banner.imageUrl}
      srcSet={getCloudinarySrcSet(banner.imageUrl)}
      sizes="100vw"
      alt={banner.title || sectionTitle || "Banner"}
      className="w-full h-full object-cover object-center"
      loading={eager ? "eager" : "lazy"}
    />
  </div>
));
FullWidthSlide.displayName = "FullWidthSlide";

const InlineSlide = memo(({ banner, stepPercent, slideGap, sectionTitle, eager }) => (
  <div
    className="relative shrink-0 flex items-center justify-center box-border h-[174px] px-0"
    style={{ width: `${stepPercent}%` }}
  >
    <div className="h-full w-full max-w-[560px] overflow-hidden rounded-[20px] bg-slate-100 shadow-md">
      <img
        src={banner.imageUrl}
        srcSet={getCloudinarySrcSet(banner.imageUrl)}
        sizes="(max-width: 768px) 100vw, 560px"
        alt={banner.title || sectionTitle || "Banner"}
        className="w-full h-full object-cover object-center"
        loading={eager ? "eager" : "lazy"}
      />
    </div>
  </div>
));
InlineSlide.displayName = "InlineSlide";

// ─── Main Carousel ─────────────────────────────────────────────────────────────
const ExperienceBannerCarousel = ({
  section,
  items,
  fullWidth = false,
  slideGap = 0,
  edgeToEdge = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  const effectiveSlideGap = fullWidth ? 0 : slideGap;
  const isMultiple = items.length > 1;

  // loopedItems sirf tab re-compute hoga jab items change ho
  const loopedItems = useMemo(
    () => (isMultiple ? [...items, items[0]] : items),
    [items, isMultiple]
  );

  const stepPercent = 100 / loopedItems.length;
  const sectionTitle = section?.title;

  // Auto-advance
  useEffect(() => {
    if (!isMultiple) return;
    const id = setInterval(() => setActiveIndex((prev) => prev + 1), 4000);
    return () => clearInterval(id);
  }, [isMultiple]);

  // Loop reset trigger
  useEffect(() => {
    if (!isMultiple || activeIndex !== items.length) return;
    const id = window.setTimeout(() => {
      setIsResetting(true);
      setActiveIndex(0);
    }, 500);
    return () => window.clearTimeout(id);
  }, [activeIndex, items.length, isMultiple]);

  // Clear reset flag after one frame
  useEffect(() => {
    if (!isResetting) return;
    const id = window.requestAnimationFrame(() => setIsResetting(false));
    return () => window.cancelAnimationFrame(id);
  }, [isResetting]);

  if (!items.length) return null;

  const trackStyle = {
    width: `${loopedItems.length * 100}%`,
    gap: effectiveSlideGap ? `${effectiveSlideGap}px` : undefined,
    transform: `translateX(-${activeIndex * stepPercent}%)`,
  };

  return (
    <div
      className={cn(
        "overflow-hidden",
        fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]"
      )}
    >
      <div
        className={cn(
          "flex ease-out",
          isResetting ? "transition-none" : "transition-transform duration-500"
        )}
        style={trackStyle}
      >
        {loopedItems.map((banner, idx) =>
          fullWidth ? (
            <FullWidthSlide
              key={idx}
              banner={banner}
              stepPercent={stepPercent}
              sectionTitle={sectionTitle}
              eager={idx === 0}
            />
          ) : (
            <InlineSlide
              key={idx}
              banner={banner}
              stepPercent={stepPercent}
              slideGap={effectiveSlideGap}
              sectionTitle={sectionTitle}
              eager={idx === 0}
            />
          )
        )}
      </div>

      {/* Pagination Dots */}
      {isMultiple && !fullWidth && (
        <div className="flex justify-center items-center gap-1.5 mt-3 pb-1">
          {items.map((_, idx) => {
            const realActiveIndex = activeIndex % items.length;
            const isActive = idx === realActiveIndex;
            return (
              <div
                key={idx}
                className={cn(
                  "h-[4px] rounded-full transition-all duration-300",
                  isActive ? "w-4 bg-black" : "w-[6px] bg-gray-200"
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default memo(ExperienceBannerCarousel);