import React from 'react';
import { Stethoscope, Pill, Search, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PharmacyEmptyState = ({ variant = 'products', className }) => {
  const config = {
    products: {
      icon: Pill,
      title: 'No medicines available yet',
      description: 'Products added by pharmacy sellers will appear here.'
    },
    categories: {
      icon: Store,
      title: 'No pharmacy categories found',
      description: 'Categories configured by admin will appear here.'
    },
    search: {
      icon: Search,
      title: 'No exact matches found',
      description: 'Try adjusting your search terms for medicines or healthcare products.'
    }
  };

  const { icon: Icon, title, description } = config[variant] || config.products;

  return (
    <div className={cn("w-full py-16 flex flex-col items-center justify-center text-center px-4", className)}>
      <div className="w-20 h-20 mb-5 text-[#2A9D8F] bg-[#2A9D8F]/10 rounded-full flex items-center justify-center">
        <Icon size={40} className="text-[#2A9D8F]" strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
      <p className="text-slate-500 text-[15px] mt-2 max-w-sm mx-auto">{description}</p>
    </div>
  );
};
