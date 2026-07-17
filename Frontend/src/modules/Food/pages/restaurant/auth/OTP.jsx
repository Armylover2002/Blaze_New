import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldCheck, Timer, RefreshCw, X } from "lucide-react"
import loginBg from "@food/assets/loginbanner.png"
import { Button } from "@food/components/ui/button"
import { restaurantAPI } from "@food/api"
import { clearOnboardingDraft } from "@food/utils/onboardingDraftStorage"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { isRestaurantOnboardingComplete, checkOnboardingStatus } from "@food/utils/onboardingUtils"
import { isRestaurantInitialPendingApproval } from "@food/utils/restaurantApproval"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { loadBusinessSettings, getAppLogo, getRestaurantLoginBanner } from "@common/utils/businessSettings"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

export default function RestaurantOTP() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('restaurant'))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getRestaurantLoginBanner()
    return (banner && banner.url && banner.active) ? banner.url : loginBg
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        await loadBusinessSettings()
        const logo = getAppLogo('restaurant')
        if (logo) {
          setLogoUrl(logo)
        }
        const banner = getRestaurantLoginBanner()
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
      const logo = getAppLogo('restaurant')
      if (logo) {
        setLogoUrl(logo)
      }
      const banner = getRestaurantLoginBanner()
      if (banner && banner.url && banner.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
  }, [])
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)
  const otpSectionRef = useRef(null)
  const [rejectionModalData, setRejectionModalData] = useState({
    isOpen: false,
    reason: "",
    phone: "",
  })

  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      if (data.method === "email" && data.email) {
        setContactInfo(data.email)
      } else if (data.phone) {
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]} ${phoneMatch[2].replace(/\D/g, "")}`
          setContactInfo(formattedPhone)
        } else {
          setContactInfo(data.phone || "")
        }
      }
    } else {
      navigate("/food/restaurant/login")
      return
    }

    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    const focusFirstInput = () => inputRefs.current[0]?.focus()
    const frameId = requestAnimationFrame(() => {
      focusFirstInput()
      window.setTimeout(focusFirstInput, 120)
    })
    return () => cancelAnimationFrame(frameId)
  }, [authData])

  useEffect(() => {
    if (typeof window === "undefined") return

    const viewport = window.visualViewport
    if (!viewport) return

    const updateKeyboardState = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height)
      setKeyboardOffset(keyboardHeight > 120 ? keyboardHeight : 0)
    }

    updateKeyboardState()
    viewport.addEventListener("resize", updateKeyboardState)
    viewport.addEventListener("scroll", updateKeyboardState)

    return () => {
      viewport.removeEventListener("resize", updateKeyboardState)
      viewport.removeEventListener("scroll", updateKeyboardState)
    }
  }, [])

  useEffect(() => {
    if (focusedIndex == null) return

    const targetInput = inputRefs.current[focusedIndex]
    if (!targetInput) return

    const id = window.setTimeout(() => {
      try {
        targetInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
        otpSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
      } catch {
        // no-op
      }
    }, 120)

    return () => window.clearTimeout(id)
  }, [focusedIndex, keyboardOffset])

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newOtp.every((digit) => digit !== "") && newOtp.length === 4) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 4) {
            newOtp[i] = digit
          }
        })
        setOtp(newOtp)
        if (digits.length === 4) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[digits.length]?.focus()
        }
      })
    }
  }

  const handlePaste = (index, e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 4) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (digits.length === 4) {
      handleVerify(newOtp.join(""))
    } else {
      inputRefs.current[digits.length]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    // Always gate — including paste/auto-fill paths that pass otpValue.
    if (hasSubmittedRef.current || isLoading) {
      return
    }

    const code = String(otpValue ?? otp.join("")).replace(/\D/g, "").slice(0, 4)

    if (code.length !== 4) {
      setError("Please enter the complete 4-digit code")
      return
    }

    hasSubmittedRef.current = true
    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please try logging in again.")
      }

      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      const response = await restaurantAPI.verifyOTP(phone, code, purpose, null, email)
      const data = response?.data?.data || response?.data

      const needsRegistration = data?.needsRegistration === true
      const normalizedPhone = data?.phone || phone

      if (data?.registrationToken) {
        sessionStorage.setItem("restaurant_registrationToken", data.registrationToken)
      }

      if (needsRegistration) {
        const displayPhone = String(normalizedPhone || phone || "")
          .replace(/\D/g, "")
          .slice(-10)
        setRestaurantPendingPhone(normalizedPhone || phone)
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        const resumeStep = Number(data?.resumeStep)
        const onboardingPath =
          resumeStep >= 2 && resumeStep <= 4
            ? `/food/restaurant/onboarding?step=${resumeStep}`
            : "/food/restaurant/onboarding"
        navigate(onboardingPath, {
          replace: true,
          state: { verifiedPhone: displayPhone },
        })
        return
      }

      if (data?.isRejected === true) {
        setIsLoading(false)
        setRejectionModalData({
          isOpen: true,
          reason: data.rejectionReason || "Please update your details and re-apply.",
          phone: normalizedPhone,
        })
        return
      }

      const accessToken = data?.accessToken
      const refreshToken = data?.refreshToken ?? null
      const restaurant = data?.user ?? data?.restaurant

      if (accessToken && restaurant) {
        const sessionPhone = String(
          normalizedPhone || restaurant?.ownerPhone || restaurant?.primaryContactNumber || phone || "",
        )
          .replace(/\D/g, "")
          .slice(-10)
        if (sessionPhone) {
          setRestaurantPendingPhone(sessionPhone)
        }

        setRestaurantAuthData("restaurant", accessToken, restaurant, refreshToken)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")

        if (data?.isPendingApproval || isRestaurantInitialPendingApproval(restaurant)) {
          navigate("/food/restaurant/pending-verification", {
            replace: true,
            state: {
              phone:
                restaurant?.ownerPhone ||
                restaurant?.primaryContactNumber ||
                normalizedPhone ||
                phone ||
                "",
            },
          })
          return
        }

        setTimeout(async () => {
          if (authData?.isSignUp) {
            navigate("/food/restaurant/onboarding", { replace: true })
          } else {
            try {
              const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
              if (!onboardingComplete) {
                const incompleteStep = await checkOnboardingStatus()
                if (incompleteStep) {
                  navigate(`/food/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
                  return
                }
              }
              navigate("/food/restaurant", { replace: true })
            } catch (err) {
              navigate("/food/restaurant", { replace: true })
            }
          }
        }, 500)
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Invalid OTP. Please try again."

      if (/pending approval/i.test(message)) {
        const pendingPhone = authData?.phone || authData?.email || contactInfo
        if (pendingPhone) {
          setRestaurantPendingPhone(pendingPhone)
        }
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: { phone: pendingPhone || "" },
        })
        return
      }

      setError(message)
      setOtp(["", "", "", ""])
      hasSubmittedRef.current = false
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please go back and try again.")
      }

      const purpose = authData.isSignUp ? "register" : "login"
      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null

      await restaurantAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    }

    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setIsLoading(false)
    setOtp(["", "", "", ""])
    hasSubmittedRef.current = false
    inputRefs.current[0]?.focus()
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) {
    return null
  }

  return (
    <div className="min-h-screen w-full flex bg-white overflow-hidden font-sans">
      {/* Left image section */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={bannerUrl}
          alt="Restaurant background"
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
              Manage your restaurant, orders and website easily from a single dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Right form section */}
      <div
        className={`w-full lg:w-1/2 h-screen flex flex-col ${keyboardOffset > 0 ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden"}`}
        style={keyboardOffset > 0 ? { paddingBottom: `${Math.min(keyboardOffset, 360)}px` } : undefined}
      >
        {/* Curved Header Background - Mobile Only */}
        <div className="relative h-[240px] sm:h-[300px] w-full bg-[#FF0000] overflow-hidden lg:hidden">
          {/* Abstract Circles like in the image */}
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute top-20 -right-10 w-64 h-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-white/5" />

          {/* The dominant curve */}
          <div className="absolute bottom-0 w-full h-[100px] bg-white rounded-t-[100px] shadow-[0_-20px_40px_rgba(0,0,0,0.05)]" />

          {/* Back Button */}
          <button
            onClick={() => navigate("/food/restaurant/login")}
            className="absolute top-10 sm:top-12 left-6 sm:left-8 p-2.5 sm:p-3 bg-white shadow-xl rounded-full text-[#FF0000] hover:scale-110 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Back Button - Desktop Only */}
        <div className="hidden lg:flex px-8 pt-8 items-center justify-start">
          <button
            onClick={() => navigate("/food/restaurant/login")}
            className="p-2.5 bg-slate-50 border border-slate-200 shadow-sm rounded-full text-[#FF0000] hover:scale-110 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center px-4 sm:px-8 -mt-12 sm:-mt-16 lg:mt-0 z-10 lg:justify-center">
          {/* Central Logo / Branding */}
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

          <div className="text-center space-y-1.5 sm:space-y-2 mb-6 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight lowercase">
              verify otp
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
              Sent to <span className="text-[#FF0000] font-black">{contactInfo}</span>
            </p>
          </div>

          <div className="w-full max-w-[400px] flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-500 lg:flex-none lg:gap-6">
            <div className="space-y-6">
              <div ref={otpSectionRef} className="flex justify-center gap-4">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={(e) => handlePaste(index, e)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    disabled={isLoading}
                    className={`w-12 h-14 sm:w-14 sm:h-16 bg-slate-50 border-2 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-none transition-all duration-300 ${error
                        ? "border-red-500 bg-red-50"
                        : focusedIndex === index
                          ? "border-[#FF0000] ring-4 ring-[#FF0000]/10 shadow-lg bg-white"
                          : "border-slate-100"
                      }`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-[#FF0000] text-xs font-bold text-center italic animate-pulse">
                  {error}
                </p>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => handleVerify()}
                  disabled={isLoading || !isOtpComplete}
                  className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase shadow-lg transition-all duration-300 ${isOtpComplete && !isLoading
                      ? "bg-[#FF0000] hover:bg-[#E64D02] text-white shadow-[#FF0000]/20 transform active:scale-[0.98]"
                      : "border-2 border-slate-300 bg-white text-slate-600 shadow-sm cursor-not-allowed"
                    }`}
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>

                <div className="flex flex-col items-center gap-4">
                  {resendTimer > 0 ? (
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black tracking-widest uppercase">
                      <Timer className="w-4 h-4 text-[#FF0000]" />
                      RESEND IN <span className="text-[#FF0000]">{resendTimer}S</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={isLoading}
                      className="flex items-center gap-2 text-[#FF0000] font-black text-xs tracking-widest uppercase hover:underline"
                    >
                      <RefreshCw className="w-4 h-4" />
                      RESEND CODE
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="py-3 text-center mt-auto pt-6">
          <p className="text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">
            SECURE VERIFICATION SYSTEM &bull; {companyName.toUpperCase()}
          </p>
        </div>
      </div>

      {rejectionModalData.isOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 transform transition-all duration-300 animate-in zoom-in-95 duration-300 flex flex-col">
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
                onClick={async () => {
                  await clearOnboardingDraft()
                  sessionStorage.setItem("restaurantReonboard", "true")
                  if (rejectionModalData.phone) {
                    localStorage.setItem("restaurant_pendingPhone", rejectionModalData.phone);
                  }
                  setRejectionModalData({ isOpen: false, reason: "", phone: "" });
                  navigate("/food/restaurant/onboarding", { replace: true });
                }}
                className="w-full h-14 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
              >
                Re-apply / Start Fresh
              </button>
              <button
                type="button"
                onClick={() => setRejectionModalData({ isOpen: false, reason: "", phone: "" })}
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
  )
}
