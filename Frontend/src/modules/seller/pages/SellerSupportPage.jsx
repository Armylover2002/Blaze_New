import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, Mail, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BlurFade } from '@/components/ui/blur-fade';
import { cn } from '@/lib/utils';
import axiosInstance from '@core/api/axios';

const FAQ_CACHE_KEY = 'seller_faqs_cache_v1';
const FAQ_CACHE_TTL_MS = 5 * 60 * 1000;

const SellerSupportPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const supportEmail = settings?.supportEmail || 'support@seller.com';
    const supportEmailShort = supportEmail ? (supportEmail.length > 12 ? supportEmail.slice(0, 12) + '...' : supportEmail) : 'support@...';
    
    const [faqs, setFaqs] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('All');

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const response = await axiosInstance.get('/quick-commerce/public/faqs', {
                    params: { audience: 'seller' }
                });
                const data = response.data?.result ?? response.data;
                const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
                setFaqs(list);
                
                // Extract unique categories
                const cats = new Set(list.map(f => f.category));
                setCategories(['All', ...Array.from(cats)]);
                
            } catch (error) {
                console.error('Error fetching FAQs:', error);
            }
        };

        fetchFaqs();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const filteredFaqs = faqs.filter(f => {
        const matchesCategory = activeCategory === 'All' || f.category === activeCategory;
        const matchesSearch = f.question.toLowerCase().includes(searchTerm.toLowerCase()) || f.answer.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-16 p-4 sm:p-0">
            <BlurFade delay={0.1}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                            Help Center
                        </h1>
                        <p className="text-slate-600 text-sm sm:text-base mt-0.5 font-medium">
                            Find quick answers to common issues
                        </p>
                    </div>
                </div>
            </BlurFade>

            <BlurFade delay={0.3}>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                    
                    <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
                        {/* Search Bar */}
                        <div className="relative group w-full md:w-80">
                            <input
                                type="text"
                                placeholder="Search FAQs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg pl-4 pr-10 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-400 shadow-sm"
                            />
                        </div>
                    </div>
                    
                    <div className="p-4 sm:p-6">
                    {/* Category Tabs */}
                    {categories.length > 1 && (
                        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-slate-100">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={cn(
                                        "px-5 py-2.5 rounded-full text-sm font-bold transition-all uppercase tracking-wide",
                                        activeCategory === cat 
                                            ? "bg-red-600 text-white shadow-lg shadow-red-200" 
                                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 ring-1 ring-slate-200"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="space-y-4">
                        {filteredFaqs.length > 0 ? (
                            filteredFaqs.map((faq) => (
                                <FAQItem
                                    key={faq._id}
                                    question={faq.question}
                                    answer={faq.answer}
                                />
                            ))
                        ) : (
                            <div className="bg-slate-50 rounded-3xl border border-dashed border-slate-200 px-6 py-16 flex flex-col items-center justify-center text-center">
                                <MessageCircle className="h-12 w-12 text-slate-300 mb-4" />
                                <p className="text-slate-600 font-bold text-lg">No FAQs found.</p>
                                <p className="text-slate-400 text-sm mt-1">Try selecting a different category or adjusting your search.</p>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            </BlurFade>
        </div>
    );
};



const FAQItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all hover:border-red-300 hover:shadow-md group">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
                <span className="font-black text-slate-800 text-[15px] group-hover:text-red-600 transition-colors">{question}</span>
                {isOpen ? <ChevronUp size={20} className="text-red-600 shrink-0" /> : <ChevronDown size={20} className="text-slate-400 shrink-0" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-50 border-t border-slate-100"
                    >
                        <div className="px-6 py-5 text-[14px] text-slate-600 font-medium leading-relaxed">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SellerSupportPage;
