import React, { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExploreGridSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";
import discoveryBg from "@food/assets/food_discovery_bg.png";

const ExploreMoreSection = memo(({
  exploreMoreHeading,
  showExploreSkeleton,
  finalExploreItems,
  backendOrigin = ""
}) => {
  return (
    <section className="px-4 py-4">
      <div className="relative rounded-[24px] overflow-hidden bg-[#1c1c1e] p-5">
        
        <h2 className="relative z-10 text-[11px] font-bold text-[#FF0000] tracking-[0.1em] uppercase mb-5 text-center">
          {exploreMoreHeading || "Explore More"}
        </h2>
        
        {showExploreSkeleton ? (
          <div className="relative z-10 w-full px-1">
            <ExploreGridSkeleton count={3} className="grid-cols-3" />
          </div>
        ) : (
          <div className="relative z-10 flex justify-around items-start gap-2">
            {finalExploreItems.map((item, index) => (
              <Link
                key={item.id}
                to={item.href}
                className="flex flex-col items-center gap-2 group w-[30%]"
              >
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-800 transition-transform duration-300 group-hover:-translate-y-1 group-active:scale-95 flex items-center justify-center overflow-hidden">
                  <OptimizedImage
                    src={item.image}
                    alt={item.label}
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    backendOrigin={backendOrigin}
                  />
                </div>
                <span className="text-[11px] font-bold text-white text-center tracking-wide group-hover:text-gray-300 transition-colors duration-300">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
});

export default ExploreMoreSection;
