import React, { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CategoryChipRowSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";
import foodPattern from "@food/assets/food_pattern_background.png";

const CategoryRail = memo(({ 
  displayCategories, 
  showCategorySkeleton,
  navigate,
  backendOrigin = "",
  hasOffers = true
}) => {
  const scrollRef = React.useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  return (
    <section className="mt-4 px-4 md:mt-6" data-purpose="mind-categories">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-[15px] font-semibold text-[#1c1c1e] dark:text-white md:text-xl tracking-tight">What's on your mind?</h3>
        <div className="flex gap-2">
          <button onClick={scrollLeft} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-0">
            <ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <button onClick={scrollRight} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-0">
            <ArrowRight className="h-4 w-4 text-gray-700" />
          </button>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-6 xl:grid-cols-8 md:gap-5 md:pb-0 scroll-smooth">
        {/* Offers Card */}
        {hasOffers && (
        <div 
          className="flex-shrink-0 flex flex-col items-center space-y-2 cursor-pointer group"
          onClick={() => navigate("/user/under-250")}
        >
          <div className="w-16 h-16 rounded-full bg-red-100/30 flex items-center justify-center p-0.5 border-2 border-[#FF0000] overflow-hidden transition-transform group-hover:scale-105 group-active:scale-95">
            <div className="bg-[#FF0000] w-full h-full rounded-full flex flex-col items-center justify-center text-white p-2">
              <span className="text-[8px] font-bold uppercase">Under</span>
              <span className="text-xs font-bold">₹200</span>
              <div className="bg-white text-[#FF0000] text-[6px] px-1 py-0.5 rounded-full mt-1 font-bold">Explore</div>
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-600">Offers</span>
        </div>
        )}

        {!showCategorySkeleton && displayCategories.map((category, index) => (
          <Link
            key={category.id || index}
            to={`/user/category/${category.slug || category.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="flex-shrink-0 flex flex-col items-center space-y-2 group"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 transition-transform group-hover:scale-110">
              <OptimizedImage
                src={category.image}
                alt={category.name}
                className="w-full h-full object-cover"
                backendOrigin={backendOrigin}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 truncate w-full text-center">
              {category.name}
            </span>
          </Link>
        ))}

        {showCategorySkeleton && <CategoryChipRowSkeleton className="flex-shrink-0" />}
      </div>
    </section>
  );
});

export default CategoryRail;
