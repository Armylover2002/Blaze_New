import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Clock3, Loader2, Phone, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { restaurantAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { loadBusinessSettings, getAppLogo, getRestaurantLoginBanner } from "@common/utils/businessSettings"
import loginBg from "@food/assets/loginbanner.png"
import RestaurantAuthFooter from "@food/components/restaurant/RestaurantAuthFooter"

const DEFAULT_COUNTRY_CODE = "+91"

export default function RestaurantLogin() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const phoneInputRef = useRef(null)
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("restaurant"))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getRestaurantLoginBanner()
    return banner?.url && banner?.active ? banner.url : loginBg
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        await loadBusinessSettings()
        const logo = getAppLogo("restaurant")
        if (logo) setLogoUrl(logo)
        const banner = getRestaurantLoginBanner()
        if (banner?.url && banner?.active) {
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
      const logo = getAppLogo("restaurant")
      if (logo) setLogoUrl(logo)
      const banner = getRestaurantLoginBanner()
      if (banner?.url && banner?.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
    return () => window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
  }, [])

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("restaurantLoginPhone")
    return {
      phone: saved || "",
      countryCode: DEFAULT_COUNTRY_CODE,
    }
  })
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return undefined

    const updateKeyboardInset = () => {
      const viewport = window.visualViewport
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(inset > 0 ? inset : 0)
    }

    updateKeyboardInset()
    window.visualViewport.addEventListener("resize", updateKeyboardInset)
    window.visualViewport.addEventListener("scroll", updateKeyboardInset)

    return () => {
      window.visualViewport.removeEventListener("resize", updateKeyboardInset)
      window.visualViewport.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [])

  useEffect(() => {
    if (keyboardInset > 0) {
      ensurePhoneFieldVisible()
    }
  }, [keyboardInset])

  const validatePhone = (phone) => {
    if (!phone || phone.trim() === "") return "Phone number is required"

    const digitsOnly = phone.replace(/\D/g, "")
    if (digitsOnly.length < 7) return "Phone number must be at least 7 digits"
    if (digitsOnly.length > 15) return "Phone number is too long"
    if (digitsOnly.length !== 10) return "Indian phone number must be 10 digits"
    if (!["6", "7", "8", "9"].includes(digitsOnly[0])) {
      return "Invalid Indian mobile number"
    }

    return ""
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData((prev) => ({ ...prev, phone: value }))
    sessionStorage.setItem("restaurantLoginPhone", value)

    if (error) {
      setError(validatePhone(value))
    }
  }

  const ensurePhoneFieldVisible = () => {
    window.setTimeout(() => {
      const content = document.getElementById("login-content")
      if (content) {
        content.scrollIntoView({ behavior: "smooth", block: "start" })
      } else {
        phoneInputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }
    }, 300)
  }

  const handleSendOTP = async () => {
    const phoneError = validatePhone(formData.phone)
    setError(phoneError)
    if (phoneError) return

    const fullPhone = `${formData.countryCode || DEFAULT_COUNTRY_CODE} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      await restaurantAPI.sendOTP(fullPhone, "login")

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      navigate("/food/restaurant/otp")
    } catch (apiErr) {
      const message =
        apiErr?.response?.data?.message ||
        apiErr?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsSending(false)
    }
  }

  const isValidPhone = !validatePhone(formData.phone)

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-white font-sans">
      {/* Left hero — unchanged */}
      <div className="relative hidden lg:flex lg:w-1/2">
        <img src={bannerUrl} alt="Restaurant background" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center text-white">
          <div
            className="max-w-[70%] rounded-r-full bg-[#FF0000]/85 py-10 pl-10 pr-10 shadow-xl backdrop-blur-[1px] xl:py-20 xl:pl-14 xl:pr-20"
            style={{ animation: "slideInLeft 0.8s ease-out both" }}
          >
            <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-wide xl:text-4xl">
              WELCOME TO
              <br />
              {companyName.toUpperCase()}
            </h1>
            <p className="max-w-xl text-base opacity-95 xl:text-lg">
              Manage your restaurant, orders and website easily from a single dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div
        className="relative flex h-screen w-full flex-col overflow-y-auto overscroll-contain lg:w-1/2"
        style={{ paddingBottom: keyboardInset ? `${keyboardInset + 24}px` : undefined }}
      >
        {/* Form panel background */}
        <div className="pointer-events-none absolute inset-0 bg-[#fafbfc]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,0,0,0.07),_transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(15,23,42,0.04),_transparent_50%)]" />
          <div
            className="absolute inset-0 opacity-[0.45]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.14) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        <div
          id="login-content"
          className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 lg:py-12"
        >
          <div className="w-full max-w-[440px]">
            {/* Step indicator */}
            <div className="mb-8 flex items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF0000] text-xs font-black text-white shadow-md shadow-[#FF0000]/25">
                  1
                </span>
                <span className="text-xs font-bold text-slate-900">Mobile</span>
              </div>
              <div className="h-px w-10 bg-slate-200 sm:w-14" />
              <div className="flex items-center gap-2 opacity-40">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-400">
                  2
                </span>
                <span className="text-xs font-semibold text-slate-400">Verify OTP</span>
              </div>
            </div>

            {/* Card with floating logo */}
            <div className="relative pt-10">
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
                <div className="rounded-2xl border-4 border-[#fafbfc] bg-white p-1.5 shadow-lg shadow-slate-900/10">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF0000] to-[#cc0000] sm:h-16 sm:w-16">
                      <ShieldCheck className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-[32px] bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.06]">
                {/* Accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-[#FF0000] via-[#ff3333] to-[#ff6b35]" />

                <div className="px-6 pb-7 pt-14 sm:px-8 sm:pb-8 sm:pt-16">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#FF0000]">
                      {companyName} Partner
                    </p>
                    <h1 className="mt-2 text-[1.65rem] font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
                      Welcome back
                    </h1>
                    <p className="mx-auto mt-2 max-w-[320px] text-sm leading-relaxed text-slate-500">
                      Sign in with your registered mobile number to manage orders, menu, and
                      payouts.
                    </p>
                  </div>

                  <div className="mt-8 space-y-6">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-0.5">
                        <label
                          htmlFor="restaurant-login-phone"
                          className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
                        >
                          Mobile number
                        </label>
                        <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                          {formData.phone.length}/10
                        </span>
                      </div>

                      <div
                        className={`group relative overflow-hidden rounded-2xl transition-all duration-200 ${
                          error
                            ? "ring-2 ring-red-200"
                            : "ring-1 ring-slate-200/80 focus-within:ring-2 focus-within:ring-[#FF0000]/20"
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 to-white" />
                        <div className="relative flex items-stretch">
                          <div className="flex items-center gap-2 border-r border-slate-200/80 bg-slate-50/90 px-4 py-4">
                            <Phone className="h-4 w-4 text-[#FF0000]" strokeWidth={2.5} />
                            <span className="text-sm font-bold text-slate-800">
                              {formData.countryCode}
                            </span>
                          </div>
                          <input
                            id="restaurant-login-phone"
                            ref={phoneInputRef}
                            type="tel"
                            maxLength={10}
                            inputMode="numeric"
                            autoComplete="tel-national"
                            enterKeyHint="done"
                            placeholder="Enter 10-digit number"
                            value={formData.phone}
                            onChange={handlePhoneChange}
                            onFocus={ensurePhoneFieldVisible}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && isValidPhone && !isSending) {
                                handleSendOTP()
                              }
                            }}
                            className="min-w-0 flex-1 border-0 bg-transparent px-4 py-4 text-[17px] font-semibold tracking-wide text-slate-900 outline-none placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {error ? (
                        <p
                          className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
                          role="alert"
                        >
                          <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                          {error}
                        </p>
                      ) : (
                        <p className="px-0.5 text-xs leading-5 text-slate-500">
                          We&apos;ll text a 4-digit OTP to this number. Standard SMS rates may apply.
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleSendOTP}
                      disabled={!isValidPhone || isSending}
                      className={`group relative h-[52px] w-full overflow-hidden rounded-2xl text-[15px] font-bold tracking-wide transition-all duration-200 ${
                        isValidPhone && !isSending
                          ? "bg-[#FF0000] text-white shadow-[0_12px_28px_rgba(255,0,0,0.28)] hover:bg-[#e60000] hover:shadow-[0_14px_32px_rgba(255,0,0,0.32)] active:scale-[0.985]"
                          : "cursor-not-allowed bg-slate-100 text-slate-400 shadow-none"
                      }`}
                    >
                      {isValidPhone && !isSending ? (
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
                      ) : null}
                      <span className="relative inline-flex items-center justify-center">
                        {isSending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending OTP...
                          </>
                        ) : (
                          <>
                            Send OTP
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </span>
                    </Button>

                    {/* Trust row */}
                    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
                      {[
                        { label: "Secure OTP", icon: ShieldCheck },
                        { label: "Instant access", icon: Zap },
                        { label: "Always on", icon: Clock3 },
                      ].map(({ label, icon: Icon }) => (
                        <div
                          key={label}
                          className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50/90 px-2 py-3 text-center"
                        >
                          <Icon className="h-3.5 w-3.5 text-[#FF0000]" strokeWidth={2.5} />
                          <span className="text-[10px] font-bold leading-tight text-slate-600">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <RestaurantAuthFooter className={`mt-7 ${keyboardInset ? "hidden" : ""}`} />

            <p
              className={`mt-5 text-center text-[10px] font-medium tracking-wide text-slate-400 ${
                keyboardInset ? "hidden" : ""
              }`}
            >
              &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
          </div>
        </div>
      </div>

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
