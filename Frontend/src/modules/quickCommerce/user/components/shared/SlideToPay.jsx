import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { ChevronRight, Check, ChevronsRight } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const SLIDER_WIDTH = 56; // px – width of the draggable circle
const SLIDER_PADDING = 8; // px – inset from container edges (left: 4px + right: 4px)
const COMPLETE_THRESHOLD = 0.9; // 90% drag = success

// ─── SlideToPay ──────────────────────────────────────────────────────────────
const SlideToPay = ({
    onSuccess,
    amount,
    isLoading = false,
    disabled = false,
    text = "Slide to Pay",
}) => {
    const [isCompleted, setIsCompleted] = useState(false);
    const controls = useAnimation();
    const x = useMotionValue(0);
    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Derived: max drag distance
    const maxDrag = Math.max(0, containerWidth - SLIDER_WIDTH - SLIDER_PADDING);

    // ─── Motion transforms (memoized by framer-motion on x changes) ──────────
    const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
    const shimmerOpacity = useTransform(x, [0, maxDrag * 0.3], [1, 0]);
    const fillWidth = useTransform(x, [0, maxDrag], [0, containerWidth]);
    const rotate = useTransform(x, [0, maxDrag], [0, 360]);
    const arrowsOpacity = useTransform(x, [0, maxDrag * 0.8], [1, 0]);
    const checkOpacity = useTransform(x, [maxDrag * 0.5, maxDrag], [0, 1]);

    // ─── Measure container width (ResizeObserver for correctness) ────────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            setContainerWidth(entry.contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ─── Drag end handler ────────────────────────────────────────────────────
    const handleDragEnd = useCallback(async () => {
        if (x.get() >= maxDrag * COMPLETE_THRESHOLD) {
            setIsCompleted(true);
            controls.start({ x: maxDrag });
            try {
                await onSuccess?.();
            } finally {
                setIsCompleted(false);
                controls.start({ x: 0 });
            }
        } else {
            controls.start({ x: 0 });
        }
    }, [x, maxDrag, controls, onSuccess]);

    const isDraggable = !isCompleted && !isLoading && !disabled;

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            className="relative h-16 w-full rounded-full overflow-hidden select-none touch-none bg-red-600 shadow-[0_18px_45px_rgba(255,0,0,0.35)] border border-white/10"
        >
            {/* Progress fill */}
            <motion.div
                className="absolute inset-y-0 left-0 bg-white/15"
                style={{ width: fillWidth }}
            />

            {/* Shimmer sweep */}
            <motion.div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ opacity: shimmerOpacity }}
            >
                <motion.div
                    className="absolute inset-y-0 -inset-x-1 bg-linear-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                />
            </motion.div>

            {/* Label (hidden while completed) */}
            {!isCompleted && (
                <motion.div
                    className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                    style={{ opacity: textOpacity }}
                >
                    <span className="text-white font-black text-sm md:text-[13px] tracking-[0.25em] uppercase flex items-center gap-2">
                        {text}{" "}
                        <span className="text-white/40">|</span>{" "}
                        <span className="text-red-50 font-extrabold">₹{amount}</span>
                    </span>
                    <div className="absolute right-4 animate-pulse text-white/70">
                        <ChevronsRight size={20} />
                    </div>
                </motion.div>
            )}

            {/* Processing label */}
            {isCompleted && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <span className="text-white font-black text-lg tracking-wide uppercase flex items-center gap-2">
                        Processing <span className="animate-pulse">...</span>
                    </span>
                </div>
            )}

            {/* Draggable knob */}
            <motion.div
                className="absolute left-1 top-1 bottom-1 w-14 h-14 bg-white rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 shadow-[0_6px_18px_rgba(242,101,34,0.35)] border border-red-100"
                drag={isDraggable ? "x" : false}
                dragConstraints={{ left: 0, right: maxDrag }}
                dragElastic={0.05}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                animate={controls}
                style={{ x }}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
            >
                {isLoading || isCompleted ? (
                    <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <motion.div
                        className="relative w-full h-full flex items-center justify-center"
                        style={{ rotate }}
                    >
                        <motion.div className="text-[#FF0000]" style={{ opacity: arrowsOpacity }}>
                            <ChevronRight size={28} strokeWidth={3} />
                        </motion.div>
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center text-[#FF0000]"
                            style={{ opacity: checkOpacity }}
                        >
                            <Check size={24} strokeWidth={3} />
                        </motion.div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default React.memo(SlideToPay);