import { X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import BottomSheetPortal from "./BottomSheetPortal"

export default function RestaurantMenuSheet({ open, onClose, menuCategories = [] }) {
  return (
    <BottomSheetPortal open={open} onClose={onClose} sheetClassName="fixed left-4 right-4 bottom-[90px] md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-[90px] z-[10000] bg-[#0a0a0a] rounded-2xl shadow-2xl w-auto flex flex-col max-h-[60vh] md:max-h-[70vh] md:w-[300px] mx-auto border border-white/10">
      <style>{`
        .menu-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .menu-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .menu-scrollbar::-webkit-scrollbar-thumb {
          background-color: #333;
          border-radius: 10px;
        }
      `}</style>
      {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 menu-scrollbar">
                    <div className="space-y-4">
                      {menuCategories.map((category, index) => (
                        <button
                          key={index}
                          className="w-full flex items-center justify-between transition-colors text-left group"
                          onClick={() => {
                            onClose()
                            // Scroll to category section
                            setTimeout(() => {
                              const sectionId = `menu-section-${category.sectionIndex}`
                              const sectionElement = document.getElementById(sectionId)
                              if (sectionElement) {
                                sectionElement.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start'
                                })
                              }
                            }, 300) // Small delay to allow sheet to close
                          }}
                        >
                          <span className="text-[15px] font-medium text-white group-hover:text-gray-300 transition-colors truncate pr-4">
                            {category.name}
                          </span>
                          <span className="text-[15px] font-medium text-white group-hover:text-gray-300 transition-colors">
                            {category.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
    </BottomSheetPortal>
  );
}
