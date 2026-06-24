import React, { useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShieldCheck, Store, KeyRound, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@food/components/ui/button";
import { useCompanyName } from "@food/hooks/useCompanyName";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { sellerApi } from "../services/sellerApi";
import {
  getAppLogo,
  getSellerLoginBanner,
  loadBusinessSettings,
} from "@common/utils/businessSettings"
import loginBg from "@food/assets/loginbanner.png";

const DEFAULT_COUNTRY_CODE = "+91";

export default function SellerAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const companyName = useCompanyName();
  const { settings } = useSettings();
  const [step, setStep] = useState("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [otpPhone, setOtpPhone] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(null);
  const inputRefs = useRef([]);
  const [rejectionModalData, setRejectionModalData] = useState({
    isOpen: false,
    reason: "",
    userPayload: null
  });
  const nextSellerPath =
    typeof location.state?.from === "string" &&
      location.state.from.startsWith("/seller")
      ? location.state.from
      : "/seller";

  const maskedPhone = useMemo(() => {
    if (phone.length < 4) return `${DEFAULT_COUNTRY_CODE} ${phone}`;
    return `${DEFAULT_COUNTRY_CODE} ${phone.slice(0, 2)}******${phone.slice(-2)}`;
  }, [phone]);


  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('seller'))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getSellerLoginBanner()
    return (banner && banner.url && banner.active) ? banner.url : loginBg
  })

  useEffect(() => {
    if (settings) {
      setLogoUrl(getAppLogo('seller'))
      const banner = getSellerLoginBanner()
      if (banner && banner.url && banner.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
  }, [settings])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        await loadBusinessSettings()
        const logo = getAppLogo('seller')
        if (logo) {
          setLogoUrl(logo)
        }
        const banner = getSellerLoginBanner()
        if (banner && banner.url && banner.active) {
          setBannerUrl(banner.url)
        } else {
          setBannerUrl(loginBg)
        }
      } catch (error) {
        console.warn("Failed to load business settings:", error)
      }
    }
    fetchSettings()

    const handleSettingsUpdate = async () => {
      await loadBusinessSettings()
      const logo = getAppLogo('seller')
      if (logo) {
        setLogoUrl(logo)
      }
      const banner = getSellerLoginBanner()
      if (banner && banner.url && banner.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
  }, [])



  const validatePhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 10) return "Enter a valid 10-digit mobile number";
    if (!["6", "7", "8", "9"].includes(digits[0])) return "Enter a valid Indian mobile number";
    return "";
  };

  const handleSendOtp = async () => {
    const validation = validatePhone(phone);
    if (validation) {
      toast.error(validation);
      return;
    }

    try {
      setIsLoading(true);
      const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim();
      const response = await sellerApi.requestOtp(fullPhone);
      const payload = response?.data?.result || response?.data?.data || response?.data || {};
      const devOtp = payload?.otp || null;
      const deliveryMode = payload?.deliveryMode || "sms";
      const resolvedPhone = String(payload?.phone || fullPhone).trim();

      toast.success(
        devOtp
          ? `OTP ready for localhost testing. Use OTP: ${devOtp}`
          : deliveryMode === "sms"
            ? "OTP sent to your seller number."
            : "OTP generated, but no debug code was returned.",
      );
      setOtpPhone(resolvedPhone);

      const resolvedOtpArray = devOtp ? String(devOtp).split("").slice(0, 4) : ["", "", "", ""];
      while (resolvedOtpArray.length < 4) resolvedOtpArray.push("");
      setOtp(resolvedOtpArray);

      setStep("otp");
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (otpValue = null) => {
    const code = otpValue || otp.join("").replace(/\D/g, "").slice(0, 4);
    if (code.length < 4) {
      toast.error("Enter the 4-digit OTP you received");
      return;
    }

    try {
      setIsLoading(true);
      const verifyPhone = String(otpPhone || `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()).trim();
      const response = await sellerApi.verifyOtp(verifyPhone, code);
      const data = response?.data?.result || response?.data?.data || response?.data || {};
      const accessToken = data?.accessToken || data?.token;
      const sellerUser = data?.seller || data?.user || data?.data?.seller || data?.data?.user;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token was returned");
      }

      const userPayload = {
        ...sellerUser,
        name:
          sellerUser?.name ||
          "Seller",
        shopName:
          sellerUser?.shopName ||
          sellerUser?.name ||
          "Store",
        phone:
          sellerUser?.phone ||
          `${DEFAULT_COUNTRY_CODE} ${phone}`.trim(),
        email: sellerUser?.email || "",
        token: accessToken,
        role: "seller",
      };

      if (sellerUser?.approvalStatus === "rejected") {
        setIsLoading(false);
        setRejectionModalData({
          isOpen: true,
          reason: sellerUser.approvalNotes || sellerUser.rejectionReason || "Your previous application was rejected. Please update your details and re-apply.",
          userPayload
        });
        return;
      }

      login(userPayload);
      toast.success(
        sellerUser?.approved === false
          ? "OTP verified. Continue your seller setup."
          : "Seller login successful",
      );
      navigate(
        sellerUser?.approved === false && sellerUser?.onboardingSubmitted !== true
          ? "/seller/onboarding"
          : nextSellerPath,
        { replace: true },
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "OTP verification failed");
      setOtp(["", "", "", ""]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit !== "") && newOtp.length === 4) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("");
    const newOtp = ["", "", "", ""];
    digits.forEach((digit, i) => {
      if (i < 4) {
        newOtp[i] = digit;
      }
    });
    setOtp(newOtp);
    if (digits.length === 4) {
      handleVerifyOtp(newOtp.join(""));
    } else {
      inputRefs.current[digits.length]?.focus();
    }
  };

  const isPhoneValid = phone.length === 10;

  return (
    <div className="min-h-screen w-full flex bg-white overflow-hidden font-sans">
      {/* Left image section */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={bannerUrl}
          alt="Seller background"
          className="w-full h-full object-cover"
        />
        {/* Orange half-circle text block attached to the left with animation */}
        <div className="absolute inset-0 flex items-center text-white pointer-events-none">
          <div
            className="bg-[#FF0000]/80 rounded-r-full py-10 xl:py-20 pl-10 xl:pl-14 pr-10 xl:pr-20 max-w-[70%] shadow-xl backdrop-blur-[1px]"
            style={{ animation: "slideInLeft 0.8s ease-out both" }}
          >
            <h1 className="text-3xl xl:text-4xl font-extrabold mb-4 tracking-wide leading-tight">
              WELCOME TO
              <br />
              {companyName.toUpperCase()}
            </h1>
            <p className="text-base xl:text-lg opacity-95 max-w-xl">
              Manage your store, products and sales easily from a single dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Right form section */}
      <div className="w-full lg:w-1/2 h-screen flex flex-col overflow-y-auto overscroll-contain bg-white">

        {/* Curved Header Background - Mobile Only */}
        <div className="relative h-[260px] sm:h-[300px] w-full bg-[#FF0000] overflow-hidden lg:hidden">
          {/* Abstract Circles like in the image */}
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute top-20 -right-10 w-64 h-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-white/5" />

          <div className="absolute bottom-0 w-full h-[100px] bg-white rounded-t-[100px] shadow-[0_-20px_40px_rgba(0,0,0,0.05)]" />

          {/* Back Button (Mobile) */}
          {step === "otp" && (
            <button
              onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); setOtpPhone(""); }}
              className="absolute top-10 sm:top-12 left-6 sm:left-8 p-2.5 sm:p-3 bg-white shadow-xl rounded-full text-[#FF0000] hover:scale-110 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        {/* Desktop Header Top Padding or Back Button (if lg screen) */}
        {step === "otp" ? (
          <div className="hidden lg:flex px-8 pt-8 items-center justify-start">
            <button
              onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); setOtpPhone(""); }}
              className="p-2.5 bg-slate-50 border border-slate-200 shadow-sm rounded-full text-[#FF0000] hover:scale-110 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="hidden lg:block lg:h-12" />
        )}

        {/* Center content */}
        <div id="login-content" className="flex-1 flex flex-col items-center px-4 sm:px-8 -mt-12 sm:-mt-16 lg:mt-0 z-10 lg:justify-center">

          {/* Logo Section */}
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-20 sm:h-24 w-auto object-contain mb-4 sm:mb-6 rounded-2xl" />
          ) : (
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-50 mb-4 sm:mb-6 overflow-hidden lg:shadow-md lg:border-2">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#FF0000] rounded-2xl mx-auto flex items-center justify-center transform rotate-12 shadow-lg mb-1">
                  <ShieldCheck className="w-8 h-8 text-white -rotate-12" />
                </div>
              </div>
            </div>
          )}

          {/* Title / Subtitle Header */}
          <div className="text-center space-y-1.5 sm:space-y-2 mb-6 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight lowercase">
              {step === "phone" ? companyName : "verify otp"}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">
              {step === "phone" ? "Seller Partner Login" : `Sent to ${maskedPhone}`}
            </p>
          </div>

          {/* Form wrapper */}
          <div className="w-full max-w-[400px] flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-500 lg:flex-none lg:gap-6">

            {step === "phone" ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">
                    Registered Mobile Number
                  </label>

                  <div className="flex items-center gap-2 h-16 bg-slate-50 border border-slate-100 rounded-[32px] px-6 focus-within:border-[#FF0000]/30 focus-within:ring-4 focus-within:ring-[#FF0000]/5 transition-all overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-lg">{DEFAULT_COUNTRY_CODE}</span>
                    </div>

                    <div className="w-[1px] h-6 bg-slate-200 ml-2" />

                    <input
                      type="tel"
                      maxLength={10}
                      inputMode="numeric"
                      placeholder="Mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="min-w-0 flex-1 h-12 bg-transparent border-0 outline-none ring-0 shadow-none focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none text-left text-lg font-bold leading-none tracking-[0.02em] text-slate-900 placeholder-slate-300 caret-[#FF0000] px-2"
                      style={{ WebkitTextFillColor: "#0f172a", opacity: 1 }}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSendOtp}
                  disabled={!isPhoneValid || isLoading}
                  className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase transition-all duration-300 ${isPhoneValid && !isLoading
                    ? "bg-[#FF0000] hover:bg-[#d5581e] text-white shadow-lg shadow-[#FF0000]/20 transform active:scale-[0.98]"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                >
                  {isLoading ? "Processing..." : "Continue"}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">

                {/* 6-Digit Grid */}
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      onFocus={() => setFocusedIndex(index)}
                      onBlur={() => setFocusedIndex(null)}
                      disabled={isLoading}
                      className={`w-10 h-14 sm:w-12 sm:h-16 bg-slate-50 border-2 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-none transition-all duration-300 ${focusedIndex === index
                        ? "border-[#FF0000] ring-4 ring-[#FF0000]/10 shadow-lg bg-white"
                        : "border-slate-100"
                        }`}
                    />
                  ))}
                </div>

                <Button
                  onClick={() => handleVerifyOtp()}
                  disabled={isLoading || otp.join("").length < 4}
                  className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase transition-all duration-300 ${otp.join("").length >= 4 && !isLoading
                    ? "bg-[#FF0000] hover:bg-[#d5581e] text-white shadow-lg shadow-[#FF0000]/20 transform active:scale-[0.98]"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
              </div>
            )}

            <div className="text-center pt-4 pb-2 lg:pb-0">
              <p className="text-slate-400 text-xs font-medium">
                By logging in, you agree to our <br />
                <button
                  type="button"
                  onClick={() => navigate("/seller/terms")}
                  className="bg-transparent border-0 p-0 text-[#FF0000] font-bold hover:underline cursor-pointer"
                >
                  Terms & Conditions
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="pb-8 text-center mt-auto pt-6">
          <p className="text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">
            &copy; {new Date().getFullYear()} {companyName.toUpperCase()} SELLER PARTNER
          </p>
        </div>
      </div>

      {rejectionModalData.isOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 transform transition-all duration-300 animate-in zoom-in-95 duration-300 flex flex-col font-sans">
            {/* Top Red Gradient Banner */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-8 text-center text-white relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm mb-3">
                <X className="w-8 h-8 text-white stroke-[3px]" />
              </div>
              <h3 className="text-xl font-black tracking-tight uppercase">Application Rejected</h3>
              <p className="text-white/80 text-xs font-semibold mt-1">Our review team has rejected your onboarding request.</p>
            </div>

            {/* Reason content */}
            <div className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rejection Reason</span>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 text-sm font-medium italic relative overflow-hidden">
                  <span className="absolute -left-1 -top-2 text-7xl text-slate-200/50 pointer-events-none select-none font-serif">“</span>
                  <p className="relative z-10 leading-relaxed font-sans">{rejectionModalData.reason}</p>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <div className="flex-1 text-xs text-amber-800 leading-relaxed font-medium">
                  <strong>Please note:</strong> Re-onboarding will clear your previous draft. You must fill out the form entirely from scratch.
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (rejectionModalData.userPayload) {
                    login(rejectionModalData.userPayload);
                    sessionStorage.setItem("sellerReonboard", "true");
                  }
                  setRejectionModalData({ isOpen: false, reason: "", userPayload: null });
                  navigate("/seller/onboarding", { replace: true });
                }}
                className="w-full h-14 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
              >
                Re-apply / Start Fresh
              </button>
              <button
                type="button"
                onClick={() => setRejectionModalData({ isOpen: false, reason: "", userPayload: null })}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-2xl font-bold text-sm tracking-wider transition-all"
              >
                Cancel / Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}