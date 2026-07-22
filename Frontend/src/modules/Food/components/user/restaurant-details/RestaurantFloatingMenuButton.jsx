import { useState } from "react";
import { Button } from "@food/components/ui/button";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

export default function RestaurantFloatingMenuButton({ hidden, onOpen }) {
  const [isTurning, setIsTurning] = useState(false);

  if (hidden) return null;

  const handleClick = (e) => {
    setIsTurning(true);
    setTimeout(() => {
      setIsTurning(false);
      onOpen(e);
    }, 400); // page turn animation duration
  };

  return (
    <div className="sticky bottom-[60px] flex justify-end px-6 z-50 mt-auto pointer-events-none">
      <Button
        className="bg-[#0a0a0a] hover:bg-black dark:bg-[#0a0a0a] dark:hover:bg-black text-white flex flex-col items-center justify-center gap-1 shadow-2xl h-[70px] w-[70px] rounded-full p-0 transform transition-all duration-300 hover:scale-105 active:scale-95 group pointer-events-auto border-none"
        onClick={handleClick}
      >
        <motion.div
          animate={isTurning ? { rotateY: 180, scale: 1.2 } : { rotateY: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <BookOpen className="h-[24px] w-[24px] text-white group-hover:-translate-y-0.5 transition-transform" fill="currentColor" />
        </motion.div>
        <span className="text-[11px] font-medium tracking-wide uppercase">MENU</span>
      </Button>
    </div>
  );
}
