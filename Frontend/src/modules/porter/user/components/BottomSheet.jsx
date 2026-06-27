import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function BottomSheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[600] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed inset-x-0 bottom-0 z-[601] rounded-t-3xl bg-white px-4 pb-8 pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.15)]"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
