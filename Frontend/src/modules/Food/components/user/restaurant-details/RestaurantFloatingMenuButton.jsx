import { Utensils } from "lucide-react";
import { Button } from "@food/components/ui/button";

export default function RestaurantFloatingMenuButton({ hidden, onOpen }) {
  if (hidden) return null;

  return (
    <div className="sticky dark:bg-[#1a1a1a] bottom-4 flex justify-end px-4 z-50 mt-auto">
      <Button
        className="bg-[#1a1a1a] dark:bg-[#FF0000] hover:bg-black dark:hover:bg-[#C83C00] text-white flex items-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/10 dark:border-[#FF0000]/20 px-6 py-6 rounded-full font-bold transform transition-all duration-300 hover:scale-110 active:scale-95 group"
        size="lg"
        onClick={onOpen}
      >
        <Utensils className="h-5 w-5 text-[#FF0000] dark:text-white group-hover:rotate-12 transition-transform" />
        <span className="tracking-wide">MENU</span>
      </Button>
    </div>
  );
}
