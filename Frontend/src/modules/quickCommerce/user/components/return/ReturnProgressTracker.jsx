import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, Loader2 } from "lucide-react";
import {
  RETURN_TIMELINE_STEPS,
  resolveReturnTimelineIndex,
  RETURN_STATUS,
} from "@/shared/utils/returnStatus";

const iconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
};

const StepRow = memo(({ step, stepStatus, index, isLast }) => {
  const isCompleted = stepStatus === "completed";
  const isActive = stepStatus === "active";
  const isRejected = stepStatus === "rejected";

  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        <motion.div
          variants={iconVariants}
          initial="initial"
          animate="animate"
          transition={{ delay: index * 0.08 }}
          className={`relative z-10 h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${
            isRejected
              ? "bg-rose-100 text-rose-600"
              : isCompleted
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                : isActive
                  ? "bg-amber-100 text-amber-600 border-2 border-amber-400"
                  : "bg-slate-100 text-slate-400"
          }`}
        >
          {isCompleted ? (
            <CheckCircle size={22} className="fill-current" />
          ) : isActive ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Circle size={20} />
          )}
        </motion.div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold ${
              isRejected
                ? "text-rose-700"
                : isCompleted
                  ? "text-slate-900"
                  : isActive
                    ? "text-amber-700"
                    : "text-slate-400"
            }`}
          >
            {step.label}
          </p>
          {isActive && (
            <p className="text-xs text-amber-600 font-medium mt-0.5">In progress...</p>
          )}
        </div>
      </div>
      {!isLast && (
        <div className="absolute left-[1.35rem] top-11 bottom-0 w-0.5 -mb-3">
          <div className={`h-full w-full ${isCompleted ? "bg-emerald-500" : "bg-slate-200"}`} />
        </div>
      )}
    </div>
  );
});
StepRow.displayName = "ReturnStepRow";

const ReturnProgressTracker = memo(({ returnDoc = {} }) => {
  const activeIndex = resolveReturnTimelineIndex(returnDoc);
  const status = String(returnDoc?.returnStatus || "");
  const isTerminalBad =
    status === RETURN_STATUS.REJECTED || status === RETURN_STATUS.CANCELLED;

  const stepStatuses = useMemo(() => {
    if (isTerminalBad) {
      return RETURN_TIMELINE_STEPS.map(() => "rejected");
    }
    return RETURN_TIMELINE_STEPS.map((_, index) => {
      if (activeIndex < 0) return index === 0 ? "active" : "pending";
      if (index < activeIndex) return "completed";
      if (index === activeIndex) return "active";
      return "pending";
    });
  }, [activeIndex, isTerminalBad]);

  if (isTerminalBad) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5">
        <p className="text-center text-rose-700 font-semibold">
          {status === RETURN_STATUS.REJECTED ? "Return Rejected" : "Return Cancelled"}
        </p>
        {returnDoc?.returnRejectedReason && (
          <p className="text-center text-sm text-rose-600 mt-2">{returnDoc.returnRejectedReason}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">
        Return progress
      </p>
      <div className="space-y-4">
        {RETURN_TIMELINE_STEPS.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            stepStatus={stepStatuses[index]}
            index={index}
            isLast={index === RETURN_TIMELINE_STEPS.length - 1}
          />
        ))}
      </div>
    </div>
  );
});

ReturnProgressTracker.displayName = "ReturnProgressTracker";

export default ReturnProgressTracker;
