import React, { memo } from "react";
import { Link } from "react-router-dom";
import { ExploreGridSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";
import { ArrowRight } from "lucide-react";

const ExploreMoreSection = memo(({
  exploreMoreHeading,
  showExploreSkeleton,
  finalExploreItems,
  backendOrigin = ""
}) => {
  const getSubtitle = (label) => {
    const map = {
      "Collections": "Curated for you",
      "Offers": "Best deals & discounts",
      "Gourmet": "Premium experiences"
    };
    return map[label] || "Explore now";
  };

  const cardThemes = [
    { bg: "bg-[#ffd1d1]", arrow: "text-[#FF0000]" }, // Noticeably darker pink
    { bg: "bg-[#d1dcff]", arrow: "text-[#3b82f6]" }, // Noticeably darker blue
    { bg: "bg-[#ffdbb3]", arrow: "text-[#f97316]" }, // Noticeably darker orange
  ];

  return (
    <section className="px-4 py-2">
      <div className="relative overflow-hidden rounded-[20px] bg-[#f0e6e6] p-3 shadow-sm border border-[#e8dada]">
        
        <div className="flex items-center justify-center gap-2 mb-3 mt-0.5">
           <span className="text-[#FF0000] text-[11px] opacity-90 leading-none">⇋</span>
           <h2 className="relative z-10 text-[12px] font-bold text-black tracking-[0.05em] uppercase">
             {exploreMoreHeading || "Explore More"}
           </h2>
           <span className="text-[#FF0000] text-[11px] opacity-90 leading-none">⇌</span>
        </div>
        
        {showExploreSkeleton ? (
           <div className="w-full px-1">
             <ExploreGridSkeleton count={3} />
           </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {finalExploreItems.map((item, index) => {
              const theme = cardThemes[index % cardThemes.length];
              return (
                <Link
                  key={item.id || `explore-${index}`}
                  to={item.href}
                  className={`relative flex flex-col p-1.5 rounded-[12px] ${theme.bg} group hover:shadow-sm transition-all duration-300 overflow-hidden pb-6`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      <OptimizedImage
                        src={item.image}
                        alt={item.label}
                        className="w-5 h-5 object-contain transition-transform duration-300 group-hover:scale-110"
                        backendOrigin={backendOrigin}
                      />
                    </div>
                    <div className="flex flex-col mt-0.5">
                      <span className="text-[9.5px] font-bold text-gray-900 leading-tight">
                        {item.label}
                      </span>
                      <span className="text-[7px] text-gray-700 mt-[1px] whitespace-nowrap">
                        {getSubtitle(item.label)}
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                    <ArrowRight className={`h-2 w-2 ${theme.arrow}`} strokeWidth={3} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});

export default ExploreMoreSection;
