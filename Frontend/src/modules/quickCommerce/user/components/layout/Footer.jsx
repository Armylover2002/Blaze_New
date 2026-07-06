import React, { useMemo, useState, useEffect } from 'react';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import Logo from '@/assets/Logo.jpeg';
import { useSettings } from '@core/context/SettingsContext';
import { shiftHex } from '../../utils/headerTheme';

// Static link lists — defined outside so they're never recreated
const QUICK_LINKS = ['Home', 'About Us', 'Shop', 'Blogs', 'Contact'];
const CATEGORIES = ['Fruits & Vegetables', 'Dairy Products', 'Meat & Fish', 'Bakery & Snacks', 'Beverages'];

const SOCIAL_ICONS = [
    { key: 'facebook', Icon: Facebook },
    { key: 'twitter', Icon: Twitter },
    { key: 'instagram', Icon: Instagram },
    { key: 'youtube', Icon: Youtube },
];

const Footer = () => {
    const { settings } = useSettings();

    const logoUrl = settings?.logoUrl || Logo;
    const defaultPrimaryColor = settings?.primaryColor || '#ea580c';

    const [themeColor, setThemeColor] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.sessionStorage.getItem('food.quick.headerColor') || defaultPrimaryColor;
        }
        return defaultPrimaryColor;
    });

    useEffect(() => {
        const handleThemeChange = () => {
            const color = window.sessionStorage.getItem('food.quick.headerColor');
            if (color) setThemeColor(color);
        };
        window.addEventListener('quickThemeChange', handleThemeChange);
        return () => window.removeEventListener('quickThemeChange', handleThemeChange);
    }, []);

    const primaryColor = themeColor;
    const appName = settings?.appName || 'DukaanWallah';
    console.log("settings?.appName :",);
    const currentYear = useMemo(() => new Date().getFullYear(), []); // year never changes in session

    // Only recompute social links when settings changes
    const socialLinks = useMemo(
        () =>
            SOCIAL_ICONS.filter(({ key }) => !!settings?.[key]).map(({ key, Icon }) => ({
                key,
                href: settings[key],
                Icon,
            })),
        [settings],
    );
    console.log("logoUrl :", logoUrl);
    return (
        <footer
            className="dynamic-footer-bg relative bg-[#1a0f05] pt-20 pb-10 mt-20 text-slate-300 md:pt-32 md:pb-16 md:mt-32 overflow-hidden transition-colors duration-500"
            style={{
                '--footer-gradient': `linear-gradient(to bottom right, ${shiftHex(themeColor, -20) || '#ea580c'}, ${themeColor || '#ea580c'}, ${shiftHex(themeColor, -40) || '#ea580c'})`
            }}
        >
            <style>{`
                @media (min-width: 768px) {
                    .dynamic-footer-bg {
                        background-image: var(--footer-gradient) !important;
                    }
                }
            `}</style>
            {/* Subtle Texture/Glow Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div
                    className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 blur-[150px]"
                    style={{ backgroundColor: primaryColor }}
                />
                <div
                    className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-[150px]"
                    style={{ backgroundColor: primaryColor }}
                />
            </div>

            {/* Top Curved Divider */}
            <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-[0]">
                <svg
                    className="relative block w-[calc(100%+1.3px)] h-[25px] md:h-[60px]"
                    data-name="Layer 1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                >
                    <path d="M0,0 Q600,120 1200,0 V0 H0 Z" className="fill-white" />
                </svg>
            </div>

            <div className="container mx-auto px-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-16">

                    {/* Brand Info */}
                    <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center">
                            <img
                                src={logoUrl}
                                alt={`${appName} Logo`}
                                className="h-12 md:h-16 w-auto object-contain"
                                loading="lazy"
                            />
                        </div>
                        <p className="text-sm leading-relaxed md:text-base md:leading-loose text-white/90 md:max-w-xs transition-opacity hover:opacity-100 font-medium">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map(({ key, href, Icon }) => (
                                <a
                                    key={key}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90"
                                >
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }} />
                            Quick Links
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            {QUICK_LINKS.map((label) => (
                                <li key={label}>
                                    <a
                                        href="#"
                                        className="hover:text-red-300 transition-colors md:text-base md:font-semibold flex items-center group text-white"
                                    >
                                        <span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all" />
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Categories */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }} />
                            Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            {CATEGORIES.map((cat) => (
                                <li key={cat}>
                                    <a
                                        href="#"
                                        className="hover:text-red-300 transition-colors md:text-base md:font-semibold flex items-center group text-white"
                                    >
                                        <span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all" />
                                        {cat}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }} />
                            Contact Us
                        </h3>
                        <ul className="space-y-4 md:space-y-6">
                            <li className="flex items-start gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90">
                                    <MapPin size={22} />
                                </div>
                                <MapPin className="mt-1 shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white md:pt-1 font-medium">{settings?.address || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90">
                                    <Phone size={22} />
                                </div>
                                <Phone className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white font-medium">{settings?.supportPhone || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90">
                                    <Mail size={22} />
                                </div>
                                <Mail className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white font-medium">{settings?.supportEmail || '—'}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm md:flex md:justify-between md:text-left md:mt-24 md:pt-12">
                    <p className="md:text-base text-white/60">
                        &copy; {currentYear} Blaze. All rights reserved.
                    </p>
                    <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0 md:gap-12">
                        <a href="#" className="hover:text-red-300 md:text-base text-white/60 transition-all">Privacy Policy</a>
                        <a href="#" className="hover:text-red-300 md:text-base text-white/60 transition-all">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default React.memo(Footer);