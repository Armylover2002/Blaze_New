import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { deliveryAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import { useCompanyName } from "@food/hooks/useCompanyName"
import {
  loadBusinessSettings,
  getCachedSettings,
  getAppFavicon,
  updateBrowserFavicon,
  getAppLogo,
} from "@common/utils/businessSettings"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


// Common country codes
const countryCodes = [
  { code: "+91", country: "IN", flag: "🇮🇳" },
]

export default function DeliverySignIn() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const referralCode = searchParams.get("ref") || ""
  const [formData, setFormData] = useState(() => {
    let initialPhone = "";
    if (typeof window !== "undefined") {
      initialPhone = sessionStorage.getItem("deliveryLoginPhone") || "";
    }
    return {
      phone: initialPhone,
      countryCode: "+91",
    };
  })
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('delivery'))

  // Pre-fill form from sessionStorage if data exists (e.g., when coming back from OTP)
  useEffect(() => {
    const stored = sessionStorage.getItem("deliveryAuthData")
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.phone) {
          // Extract digits after +91
          const phoneDigits = data.phone.replace("+91", "").trim()
          setFormData(prev => ({
            ...prev,
            phone: phoneDigits
          }))
        }
      } catch (err) {
        debugError("Error parsing stored auth data:", err)
      }
    }
  }, [])

  useEffect(() => {
    const applyDeliveryBranding = () => {
      const deliveryFavicon = getAppFavicon("delivery")
      if (deliveryFavicon) {
        updateBrowserFavicon(deliveryFavicon)
      }
      const deliveryLogo = getAppLogo("delivery")
      if (deliveryLogo) {
        setLogoUrl(deliveryLogo)
      }
    }

    const cached = getCachedSettings()
    if (cached) {
      applyDeliveryBranding()
    } else {
      loadBusinessSettings().then(() => {
        applyDeliveryBranding()
      })
    }

    const handleSettingsUpdate = (event) => {
      const settings = event?.detail
      if (!settings) return
      const favicon = settings.deliveryFavicon?.url || settings.favicon?.url || ""
      if (favicon) {
        updateBrowserFavicon(favicon)
      }
      const deliveryLogo = getAppLogo("delivery")
      if (deliveryLogo) {
        setLogoUrl(deliveryLogo)
      }
    }

    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
    return () => {
      window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
    }
  }, [])
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    const digitsOnly = phone.replace(/\D/g, "")

    if (digitsOnly.length < 7) {
      return "Phone number must be at least 7 digits"
    }

    // India-specific validation
    // India-specific validation (Fixed to +91 only)
    if (digitsOnly.length !== 10) {
      return "Phone number must be exactly 10 digits"
    }

    return ""
  }

  const handleSendOTP = async () => {
    setError("")

    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      // Start a fresh login flow and prevent stale-token auto redirects.
      clearModuleAuth("delivery")

      // Call backend to send OTP for delivery login
      await deliveryAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        purpose: "login",
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))

      if (referralCode) {
        try {
          const existingSignupDetails = JSON.parse(sessionStorage.getItem("deliverySignupDetails") || "{}")
          sessionStorage.setItem("deliverySignupDetails", JSON.stringify({
            ...existingSignupDetails,
            ref: referralCode
          }))
        } catch (e) { }
      }

      // Navigate to OTP page
      navigate("/food/delivery/otp")
    } catch (err) {
      debugError("Send OTP Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    // Only allow digits and limit to 10 digits
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData({
      ...formData,
      phone: value,
    })
    if (typeof window !== "undefined") {
      sessionStorage.setItem("deliveryLoginPhone", value)
    }
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const isValid = !validatePhone(formData.phone, formData.countryCode)

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Top Banner section - Orange */}
      <div className="w-full bg-red-600 rounded-b-[2.5rem] p-6 text-center text-white relative overflow-hidden shadow-xl mb-6">
        <div className="absolute inset-0 bg-white/5 opacity-50 blur-3xl rounded-full -top-1/2 -left-1/4 animate-pulse" />

        <div className="relative z-10 flex flex-col items-center pt-4 pb-2">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-lg overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="w-full h-full object-contain p-2" />
            ) : (
              <span className="text-red-600 text-2xl font-black italic">{companyName.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">
            {companyName}
          </h1>

          {/* DELIVERY Badge */}
          <div className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/30">
            <span className="text-white font-bold text-xs uppercase tracking-[0.2em]">
              Delivery Partner
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Form Section */}
      <div className="flex-1 flex flex-col px-6">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Sign In Heading */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-black">
              Sign in to your account
            </h2>
            <p className="text-base text-gray-600">
              Login with your phone number
            </p>
          </div>

          {/* Mobile Number Input */}
          <div className="space-y-2 w-full">
            <div className="flex gap-2 items-stretch w-full">
              <div className="flex items-center px-4 h-12 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg shrink-0">
                <span className="flex items-center gap-2 text-base font-medium">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                value={formData.phone}
                onChange={handlePhoneChange}
                autoComplete="off"
                autoFocus={false}
                className={`flex-1 h-12 px-4 text-gray-900 placeholder-gray-400 focus:outline-none text-base border rounded-lg min-w-0 ${error ? "border-red-500" : "border-gray-300"
                  }`}
              />
            </div>

            {/* Hint Text */}
            <p className="text-sm text-gray-500">
              Enter exactly 10 digits
            </p>

            {error && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section - Continue Button and Terms */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto space-y-4">
          {/* Continue Button */}
          <button
            onClick={handleSendOTP}
            disabled={!isValid || isSending}
            className={`w-full py-4 rounded-xl font-black text-lg transition-all shadow-lg ${isValid && !isSending
              ? "bg-red-600 hover:bg-primary-hover active:scale-[0.98] text-white hover:shadow-xl"
              : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
              }`}
          >
            {isSending ? "Sending OTP..." : "Continue"}
          </button>

          {/* Terms and Conditions */}
          <p className="text-xs text-center text-gray-500 px-4 font-medium uppercase tracking-widest leading-relaxed mt-4">
            By continuing, you agree to our{" "}
            <Link to="/food/delivery/terms" className="text-red-600 hover:underline font-bold">
              Terms and Conditions
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}


