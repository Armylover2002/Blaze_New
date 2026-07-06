import { X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import BottomSheetPortal from "./BottomSheetPortal"

export default function RestaurantMenuSheet({ open, onClose, menuCategories = [] }) {
  return (
    <BottomSheetPortal open={open} onClose={onClose} sheetClassName="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-auto flex flex-col max-h-[85vh] md:max-h-[90vh] md:max-w-lg">
      {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-6">
                    <div className="space-y-1">
                      {menuCategories.map((category, index) => (
                        <button
                          key={index}
                          className="w-full flex items-center justify-between py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
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
                          <div className="flex items-center gap-3 min-w-0">
                            {category.image ? (
                              <img
                                src={category.image}
                                alt={category.name}
                                className="h-10 w-10 rounded-xl object-cover border border-gray-200"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none"
                                }}
                              />
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold uppercase text-gray-500">
                                {category.name?.charAt(0) || "C"}
                              </span>
                            )}
                            <span className="text-base font-medium text-gray-900 dark:text-white truncate">
                              {category.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {category.count}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Close Button */}
                  <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]">
                    <Button
                      className="w-full bg-[#1a1a1a] dark:bg-[#FF0000] hover:bg-[#FF0000] dark:hover:bg-[#C83C00] text-white border-0 flex items-center justify-center gap-2 py-6 rounded-xl font-bold transition-all shadow-lg"
                      onClick={() => onClose()}
                    >
                      <X className="h-5 w-5" />
                      Close
                    </Button>
                  </div>
    </BottomSheetPortal>
  );
}
