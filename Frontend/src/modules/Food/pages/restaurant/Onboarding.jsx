import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { Label } from "@food/components/ui/label"
import { Image as ImageIcon, Upload, Clock, Calendar as CalendarIcon, Sparkles, X, LogOut, ChevronLeft } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@food/components/ui/popover"
import { Calendar } from "@food/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { restaurantAPI, zoneAPI, api, onboardingFeeAPI } from "@food/api"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { determineStepToShow } from "@food/utils/onboardingUtils"
import { toast } from "sonner"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { clearModuleAuth, clearAuthData, getRestaurantPendingPhone } from "@food/utils/auth"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { convertBase64ToFile, isFlutterBridgeAvailable, openCamera } from "@food/utils/imageUploadUtils"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ESTIMATED_DELIVERY_TIME_OPTIONS = [
  "10-15 mins",
  "15-20 mins",
  "20-25 mins",
  "25-30 mins",
  "30-35 mins",
  "35-40 mins",
  "40-45 mins",
  "45-50 mins",
  "50-60 mins",
]

const ONBOARDING_STORAGE_KEY = "restaurant_onboarding_data"
const PAN_NUMBER_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const FSSAI_NUMBER_REGEX = /^\d{14}$/
const BANK_ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/
const IFSC_CODE_REGEX = /^[A-Z0-9]{11}$/
const ACCOUNT_HOLDER_NAME_REGEX = /^[A-Za-z ]+$/
const GST_LEGAL_NAME_REGEX = /^[A-Za-z ]+$/
const FEATURED_DISH_NAME_REGEX = /^[A-Za-z ]+$/
const NAME_REGEX = /^[A-Za-z ]+$/
const OWNER_EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
const PHONE_NUMBER_REGEX = /^\d{10,12}$/
const PRIMARY_PHONE_NUMBER_REGEX = /^\d{10}$/
const PINCODE_REGEX = /^\d{6}$/
const LOCAL_IMAGE_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif"
const GALLERY_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
const ONBOARDING_DRAFT_FILE_MAX_SIZE = 2.5 * 1024 * 1024
let onboardingFileCache = {
  step2: {
    menuImages: [],
    profileImage: null,
  },
  step3: {
    panImage: null,
    gstImage: null,
    fssaiImage: null,
  },
}

const isUploadableFile = (value) => {
  if (!value || typeof value !== "object") return false

  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true

  return (
    typeof value.size === "number" &&
    (typeof value.slice === "function" || typeof value.arrayBuffer === "function")
  )
}

const getImageAssetUrl = (value) => {
  if (!value) return ""
  if (typeof value === "string" && value.startsWith("http")) return value
  if (value?.url && typeof value.url === "string") return value.url
  return ""
}

const hasValidImageAsset = (value) => isUploadableFile(value) || Boolean(getImageAssetUrl(value))

const hasValidMenuImageAsset = (value) => hasValidImageAsset(value)

const pickNonEmpty = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === "string" && !value.trim()) continue
    return value
  }
  return ""
}

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "").slice(-15)

const getDisplayPhone = (value) => normalizePhoneDigits(value).slice(-10)

const buildOnboardingStepFormData = (stepNum, { step1, step2, step3 }) => {
  const formData = new FormData()
  formData.append("ownerPhone", normalizePhoneDigits(step1.ownerPhone))

  if (stepNum === 1) {
    formData.append("restaurantName", step1.restaurantName || "")
    formData.append(
      "pureVegRestaurant",
      step1.pureVegRestaurant === true ? "true" : "false",
    )
    formData.append("ownerName", step1.ownerName || "")
    formData.append("ownerEmail", (step1.ownerEmail || "").trim())
    formData.append("primaryContactNumber", normalizePhoneDigits(step1.primaryContactNumber))
    formData.append("zoneId", step1.zoneId || "")
    formData.append("addressLine1", step1.location?.addressLine1 || "")
    formData.append("addressLine2", step1.location?.addressLine2 || "")
    formData.append("area", step1.location?.area || "")
    formData.append("city", step1.location?.city || "")
    formData.append("state", step1.location?.state || "")
    formData.append("pincode", step1.location?.pincode || "")
    formData.append("landmark", step1.location?.landmark || "")
    formData.append("formattedAddress", step1.location?.formattedAddress || "")
    formData.append("latitude", String(step1.location?.latitude || ""))
    formData.append("longitude", String(step1.location?.longitude || ""))
    formData.append("ref", step1.ref || "")
  }

  if (stepNum === 2) {
    formData.append("cuisines", (step2.cuisines || []).join(","))
    formData.append("openingTime", normalizeTimeValue(step2.openingTime) || "")
    formData.append("closingTime", normalizeTimeValue(step2.closingTime) || "")
    formData.append("openDays", (step2.openDays || []).join(","))

    const menuFiles = (step2.menuImages || []).filter((f) => isUploadableFile(f))
    menuFiles.forEach((file) => formData.append("menuImages", file))

    if (isUploadableFile(step2.profileImage)) {
      formData.append("profileImage", step2.profileImage)
    }
  }

  if (stepNum === 3) {
    formData.append("panNumber", step3.panNumber || "")
    formData.append("nameOnPan", step3.nameOnPan || "")
    if (isUploadableFile(step3.panImage)) {
      formData.append("panImage", step3.panImage)
    }

    formData.append("gstRegistered", step3.gstRegistered ? "true" : "false")
    if (step3.gstRegistered) {
      formData.append("gstNumber", step3.gstNumber || "")
      formData.append("gstLegalName", step3.gstLegalName || "")
      formData.append("gstAddress", step3.gstAddress || "")
      if (isUploadableFile(step3.gstImage)) {
        formData.append("gstImage", step3.gstImage)
      }
    }

    formData.append("fssaiNumber", step3.fssaiNumber || "")
    formData.append("fssaiExpiry", step3.fssaiExpiry || "")
    if (isUploadableFile(step3.fssaiImage)) {
      formData.append("fssaiImage", step3.fssaiImage)
    }

    formData.append("accountNumber", step3.accountNumber || "")
    formData.append("ifscCode", (step3.ifscCode || "").toUpperCase())
    formData.append("accountHolderName", step3.accountHolderName || "")
    formData.append("accountType", step3.accountType || "")
  }

  return formData
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error("Failed to read image"))
      reader.readAsDataURL(file)
    } catch (error) {
      reject(error)
    }
  })

const DB_NAME = "RestaurantOnboardingDB"
const STORE_NAME = "onboarding_files"

let cachedDB = null
const initDB = () => {
  return new Promise((resolve) => {
    if (cachedDB) {
      return resolve(cachedDB)
    }
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return resolve(null)
    }
    const timeoutId = setTimeout(() => resolve(null), 2000)
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = (e) => {
        clearTimeout(timeoutId)
        cachedDB = e.target.result
        resolve(cachedDB)
      }
      request.onerror = () => {
        clearTimeout(timeoutId)
        resolve(null)
      }
    } catch (e) {
      clearTimeout(timeoutId)
      resolve(null)
    }
  })
}

const saveFileToDB = async (key, file) => {
  if (!file) return removeFileFromDB(key)
  const db = await initDB()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      store.put(file, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    } catch (e) {
      resolve()
    }
  })
}

const getFileFromDB = async (key) => {
  const db = await initDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch (e) {
      resolve(null)
    }
  })
}

const removeFileFromDB = async (key) => {
  const db = await initDB()
  if (!db) return
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).delete(key)
  } catch (e) {
    debugError("Error removing file from DB:", e)
  }
}

const serializeDraftImage = async (value, fallbackPrefix) => {
  if (!value) {
    await removeFileFromDB(fallbackPrefix)
    return null
  }

  if (isUploadableFile(value)) {
    await saveFileToDB(fallbackPrefix, value)
    return {
      kind: "db-file",
      dbKey: fallbackPrefix,
      name: value.name || `${fallbackPrefix}-${Date.now()}.jpg`,
      mimeType: value.type || "image/jpeg",
      lastModified: Number(value.lastModified || Date.now()),
    }
  }

  if (typeof value === "string" && value.startsWith("http")) return value
  if (value?.url && typeof value.url === "string") return value

  return null
}

const restoreDraftImage = async (value, fallbackPrefix) => {
  if (!value) return null

  if (value?.kind === "db-file" && value?.dbKey) {
    try {
      const file = await getFileFromDB(value.dbKey)
      if (file && (file instanceof File || file instanceof Blob)) {
        return file instanceof File ? file : new File([file], value.name || `${fallbackPrefix}.jpg`, { type: value.mimeType || file.type || "image/jpeg" })
      }
    } catch {
      return null
    }
  }

  if (value?.kind === "draft-file" && value?.dataUrl) {
    try {
      return convertBase64ToFile(
        value.dataUrl,
        value.mimeType || "image/jpeg",
        fallbackPrefix,
        value.name || "",
      )
    } catch {
      return null
    }
  }

  if (typeof value === "string" && value.startsWith("http")) return value
  if (value?.url && typeof value.url === "string") return value

  return null
}

const getVerifiedPhoneFromStoredRestaurant = () => {
  try {
    const pending = getRestaurantPendingPhone() || localStorage.getItem("restaurant_pendingPhone")
    if (pending && pending.trim()) {
      return getDisplayPhone(pending.trim())
    }

    const authDataRaw = sessionStorage.getItem("restaurantAuthData")
    if (authDataRaw) {
      const authData = JSON.parse(authDataRaw)
      if (authData?.phone?.trim()) {
        return getDisplayPhone(authData.phone.trim())
      }
    }

    const loginPhone = sessionStorage.getItem("restaurantLoginPhone")
    if (loginPhone && loginPhone.trim()) {
      return getDisplayPhone(loginPhone.trim())
    }

    const storedUser = localStorage.getItem("restaurant_user")
    if (!storedUser) return ""
    const user = JSON.parse(storedUser)
    const candidates = [
      user?.ownerPhone,
      user?.primaryContactNumber,
      user?.phone,
      user?.phoneNumber,
      user?.mobile,
      user?.contactNumber,
      user?.contact?.phone,
      user?.owner?.phone,
      user?.restaurant?.phone,
    ]
    const phone = candidates.find((value) => typeof value === "string" && value.trim())
    return phone ? getDisplayPhone(phone.trim()) : ""
  } catch {
    return ""
  }
}

const resolveVerifiedOwnerPhone = (...candidates) => {
  for (const value of candidates) {
    const display = getDisplayPhone(value)
    if (display) return display
  }
  return ""
}

const normalizeAccountTypeValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "saving" || normalized === "savings") return "Saving"
  if (normalized === "current") return "Current"
  return ""
}

const normalizeZoneIdValue = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value
  return String(value?._id || value?.id || value || "")
}

const getTodayLocalYMD = () => formatDateToLocalYMD(new Date())

// Helper functions for localStorage
const saveOnboardingToLocalStorage = async (step1, step2, step3, step4, currentStep) => {
  try {
    const serializedMenuImages = await Promise.all(
      (step2.menuImages || []).map((img, index) =>
        serializeDraftImage(img, `menu-image-${index + 1}`),
      ),
    )

    const serializableStep2 = {
      ...step2,
      menuImages: serializedMenuImages.filter(Boolean),
      profileImage: await serializeDraftImage(step2.profileImage, "restaurant-profile"),
    }

    const serializableStep3 = {
      ...step3,
      panImage: await serializeDraftImage(step3.panImage, "pan-image"),
      gstImage: await serializeDraftImage(step3.gstImage, "gst-image"),
      fssaiImage: await serializeDraftImage(step3.fssaiImage, "fssai-image"),
    }

    const dataToSave = {
      step1: {
        ...step1,
        ownerPhone:
          resolveVerifiedOwnerPhone(step1.ownerPhone, getVerifiedPhoneFromStoredRestaurant()) ||
          step1.ownerPhone,
      },
      step2: serializableStep2,
      step3: serializableStep3,
      step4: step4 || {},
      currentStep,
      timestamp: Date.now(),
    }
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(dataToSave))
  } catch (error) {
    debugError("Failed to save onboarding data to localStorage:", error)
  }
}

const loadOnboardingFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    debugError("Failed to load onboarding data from localStorage:", error)
  }
  return null
}

const clearOnboardingFromLocalStorage = () => {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    localStorage.removeItem("restaurant_pendingPhone")
    const docKeys = [
      "restaurant-profile",
      "pan-image",
      "gst-image",
      "fssai-image",
      ...Array.from({ length: 20 }, (_, i) => `menu-image-${i + 1}`)
    ]
    docKeys.forEach(key => removeFileFromDB(key))
  } catch (error) {
    debugError("Failed to clear onboarding data from localStorage:", error)
  }
}

const syncOnboardingFileCache = (step2, step3) => {
  onboardingFileCache = {
    step2: {
      menuImages: (step2?.menuImages || []).filter((img) => isUploadableFile(img)),
      profileImage: isUploadableFile(step2?.profileImage) ? step2.profileImage : null,
    },
    step3: {
      panImage: isUploadableFile(step3?.panImage) ? step3.panImage : null,
      gstImage: isUploadableFile(step3?.gstImage) ? step3.gstImage : null,
      fssaiImage: isUploadableFile(step3?.fssaiImage) ? step3.fssaiImage : null,
    },
  }
}

const clearOnboardingFileCache = () => {
  onboardingFileCache = {
    step2: {
      menuImages: [],
      profileImage: null,
    },
    step3: {
      panImage: null,
      gstImage: null,
      fssaiImage: null,
    },
  }
}

// Helper function to convert "HH:mm" string to Date object
const stringToTime = (timeString) => {
  const normalized = normalizeTimeValue(timeString)
  if (!normalized || !normalized.includes(":")) {
    return null
  }
  const [hours, minutes] = normalized.split(":").map(Number)
  return new Date(2000, 0, 1, hours || 0, minutes || 0)
}

// Helper function to convert Date object to "HH:mm" string
const timeToString = (date) => {
  if (!date) return ""
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

const normalizeTimeValue = (value) => {
  if (!value) return ""

  const raw = String(value).trim()
  if (!raw) return ""

  // Already in HH:mm format
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw
  }

  // Handle H:mm by zero-padding hour
  if (/^\d{1}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":")
    return `${h.padStart(2, "0")}:${m}`
  }

  // Fallback for ISO / Date-like strings
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return timeToString(parsed)
  }

  return ""
}

const formatDateToLocalYMD = (date) => {
  if (!date || Number.isNaN(date.getTime?.())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseLocalYMDDate = (value) => {
  if (!value || typeof value !== "string") return undefined
  const parts = value.split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

/**
 * Ray-casting point-in-polygon check for frontend validation.
 */
const isPointInPolygon = (lat, lng, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i].longitude || polygon[i].lng)
    const yi = Number(polygon[i].latitude || polygon[i].lat)
    const xj = Number(polygon[j].longitude || polygon[j].lng)
    const yj = Number(polygon[j].latitude || polygon[j].lat)
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Calculate the center of a zone polygon to serve as a geofencing fallback.
 */
const getZoneCenter = (zone) => {
  if (!zone || !Array.isArray(zone.coordinates) || zone.coordinates.length === 0) return null
  let latSum = 0
  let lngSum = 0
  let count = 0
  zone.coordinates.forEach((coord) => {
    const lat = Number(coord?.latitude || coord?.lat || (Array.isArray(coord) && coord.length >= 2 ? coord[1] : NaN))
    const lng = Number(coord?.longitude || coord?.lng || (Array.isArray(coord) && coord.length >= 2 ? coord[0] : NaN))
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      latSum += lat
      lngSum += lng
      count++
    }
  })
  if (count > 0) {
    return {
      latitude: Number((latSum / count).toFixed(6)),
      longitude: Number((lngSum / count).toFixed(6)),
    }
  }
  return null
}

function TimeSelector({ label, value, onChange }) {
  const timeValue = stringToTime(value)

  const handleTimeChange = (newValue) => {
    if (!newValue) {
      onChange("")
      return
    }
    const timeString = timeToString(newValue)
    onChange(timeString)
  }

  return (
    <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-gray-800" />
        <span className="text-xs font-medium text-gray-900">{label}</span>
      </div>
      <MobileTimePicker
        value={timeValue}
        onChange={handleTimeChange}
        onAccept={handleTimeChange}
        slotProps={{
          textField: {
            variant: "outlined",
            size: "small",
            placeholder: "Select time",
            sx: {
              "& .MuiOutlinedInput-root": {
                height: "36px",
                fontSize: "12px",
                backgroundColor: "white",
                "& fieldset": {
                  borderColor: "#e5e7eb",
                },
                "&:hover fieldset": {
                  borderColor: "#d1d5db",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#000",
                },
              },
              "& .MuiInputBase-input": {
                padding: "8px 12px",
                fontSize: "12px",
              },
            },
            onBlur: (event) => {
              const normalized = normalizeTimeValue(event?.target?.value)
              if (normalized) {
                onChange(normalized)
              }
            },
          },
        }}
        format="hh:mm a"
      />
    </div>
  )
}

export default function RestaurantOnboarding() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [feeConfig, setFeeConfig] = useState(undefined)
  const [fetchingFees, setFetchingFees] = useState(false)
  const [isReonboardBypass, setIsReonboardBypass] = useState(false)

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setFetchingFees(true)
        const res = await onboardingFeeAPI.getPublicFees()
        const fees = res?.data?.data || res?.data
        if (fees && fees.RESTAURANT) {
          setFeeConfig(fees.RESTAURANT)
        }
      } catch (err) {
        debugError("Failed to fetch public onboarding fee:", err)
      } finally {
        setFetchingFees(false)
      }
    }
    fetchFees()
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await restaurantAPI.logout()
      clearModuleAuth("restaurant")
      clearAuthData()
      clearOnboardingFromLocalStorage()
      clearOnboardingFileCache()
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/login", { replace: true })
    } catch (error) {
      debugError("Logout failed:", error)
      clearModuleAuth("restaurant")
      clearOnboardingFromLocalStorage()
      clearOnboardingFileCache()
      navigate("/food/restaurant/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState(() =>
    resolveVerifiedOwnerPhone(
      location.state?.verifiedPhone,
      getVerifiedPhoneFromStoredRestaurant(),
    ),
  )
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [isEditing, setIsEditing] = useState(true)
  const [isFssaiCalendarOpen, setIsFssaiCalendarOpen] = useState(false)
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)

  const [step1, setStep1] = useState(() => {
    const verified = resolveVerifiedOwnerPhone(
      location.state?.verifiedPhone,
      getVerifiedPhoneFromStoredRestaurant(),
    )
    return {
      restaurantName: "",
      pureVegRestaurant: null,
      ownerName: "",
      ownerEmail: "",
      ownerPhone: verified,
      primaryContactNumber: verified,
      zoneId: "",
      ref: "",
      location: {
        formattedAddress: "",
        addressLine1: "",
        addressLine2: "",
        area: "",
        city: "",
        state: "",
        pincode: "",
        landmark: "",
        latitude: "",
        longitude: "",
      },
    }
  })

  const [step2, setStep2] = useState({
    menuImages: [],
    profileImage: null,
    cuisines: [],
    openingTime: "",
    closingTime: "21:00",
    openDays: [],
  })

  const [step3, setStep3] = useState({
    panNumber: "",
    nameOnPan: "",
    panImage: null,
    gstRegistered: false,
    gstNumber: "",
    gstLegalName: "",
    gstAddress: "",
    gstImage: null,
    fssaiNumber: "",
    fssaiExpiry: "",
    fssaiImage: null,
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    accountType: "",
  })

  const [step4, setStep4] = useState({
    estimatedDeliveryTime: "",
    featuredDish: "",
    featuredPrice: "",
    offer: "",
  })
  const previewUrlCacheRef = useRef(new Map())
  const locationSearchInputRef = useRef(null)
  const placesAutocompleteRef = useRef(null)
  const mapsScriptLoadedRef = useRef(false)
  // Track whether user picked from Places suggestion (has lat/lng) or typed manually
  const [locationPickedFromSuggestion, setLocationPickedFromSuggestion] = useState(false)
  const hasRestoredDraftStepRef = useRef(false)
  const onboardingDraftRef = useRef(null)
  const menuImagesInputRef = useRef(null)
  const profileImageInputRef = useRef(null)
  const panImageInputRef = useRef(null)
  const gstImageInputRef = useRef(null)
  const fssaiImageInputRef = useRef(null)
  const [sourcePicker, setSourcePicker] = useState({
    isOpen: false,
    title: "",
    onSelectFile: null,
    fileNamePrefix: "camera-image",
    fallbackInputRef: null,
  })

  const goToStep = (nextStep, options = {}) => {
    const normalizedStep = Math.min(4, Math.max(1, Number(nextStep) || 1))
    const shouldReplace = options.replace === true
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set("step", String(normalizedStep))
    setStep(normalizedStep)
    setSearchParams(nextParams, { replace: shouldReplace })
  }

  const getPreviewImageUrl = (value) => {
    if (!value) return null
    if (typeof value === "string") return value
    if (value?.url && typeof value.url === "string") return value.url

    if (isUploadableFile(value)) {
      const cache = previewUrlCacheRef.current
      const cached = cache.get(value)
      if (cached) return cached
      try {
        const objectUrl = URL.createObjectURL(value)
        cache.set(value, objectUrl)
        return objectUrl
      } catch {
        return null
      }
    }

    return null
  }

  const openBrowserCameraFallback = ({ onSelectFile }) => {
    try {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*"
      input.capture = "environment"
      input.onchange = (event) => {
        const file = event?.target?.files?.[0] || null
        if (file) onSelectFile(file)
      }
      input.click()
    } catch (error) {
      debugError("Browser camera fallback failed:", error)
    }
  }

  const openImageSourcePicker = ({ title, onSelectFile, fileNamePrefix, fallbackInputRef }) => {
    setSourcePicker({
      isOpen: true,
      title: title || "Select image source",
      onSelectFile,
      fileNamePrefix: fileNamePrefix || "camera-image",
      fallbackInputRef: fallbackInputRef || null,
    })
  }

  const closeImageSourcePicker = () => {
    setSourcePicker((prev) => ({ ...prev, isOpen: false }))
  }

  const handlePickFromDevice = () => {
    const fallbackRef = sourcePicker.fallbackInputRef
    closeImageSourcePicker()
    fallbackRef?.current?.click()
  }

  const handlePickFromCamera = async () => {
    const pickerConfig = {
      onSelectFile: sourcePicker.onSelectFile,
      fileNamePrefix: sourcePicker.fileNamePrefix,
    }
    closeImageSourcePicker()
    await openCamera(pickerConfig)
  }

  const openOnboardingImagePicker = ({
    title,
    fallbackInputRef,
    fileNamePrefix,
    onSelectFile,
  }) => {
    openImageSourcePicker({
      title,
      fallbackInputRef,
      fileNamePrefix,
      onSelectFile,
    })
  }


  // Load from localStorage/server on mount and check URL parameter
  useEffect(() => {
    const navigationVerifiedPhone = resolveVerifiedOwnerPhone(
      location.state?.verifiedPhone,
      getVerifiedPhoneFromStoredRestaurant(),
    )
    if (navigationVerifiedPhone) {
      setVerifiedPhoneNumber(navigationVerifiedPhone)
    }

    const initOnboardingData = async () => {
      try {
        setLoading(true)

        let serverData = null
        let isReonboard = sessionStorage.getItem("restaurantReonboard") === "true"

        if (isReonboard) {
          setIsEditing(true)
          setIsReonboardBypass(true) // bypass payment for re-applying
        } else {
          try {
            const res = await restaurantAPI.getCurrentRestaurant()
            serverData = res?.data?.data?.restaurant || res?.data?.restaurant
          } catch (err) {
            setIsEditing(true)
            if (err?.response?.status === 401) {
              debugError("Authentication error fetching onboarding:", err)
            } else {
              debugError("Error fetching onboarding data:", err)
            }
          }
        }

        const verifiedPhone = resolveVerifiedOwnerPhone(
          location.state?.verifiedPhone,
          getVerifiedPhoneFromStoredRestaurant(),
        )

        // Fetch server-side draft for in-progress onboarding (resume after tab close)
        if (!serverData && !isReonboard && verifiedPhone) {
          try {
            const draftRes = await restaurantAPI.getOnboardingDraft(verifiedPhone)
            const draftData = draftRes?.data?.data?.restaurant || draftRes?.data?.restaurant
            if (draftData?.status === "onboarding") {
              serverData = draftData
              onboardingDraftRef.current = draftData
            }
          } catch (draftErr) {
            if (draftErr?.response?.status !== 404) {
              debugError("Error fetching onboarding draft:", draftErr)
            }
          }
        }

        // 1. Initial Default State
        let initialStep1 = {
          restaurantName: "",
          pureVegRestaurant: null,
          ownerName: "",
          ownerEmail: "",
          ownerPhone: verifiedPhone,
          primaryContactNumber: verifiedPhone,
          zoneId: "",
          ref: "",
          location: {
            formattedAddress: "",
            addressLine1: "",
            addressLine2: "",
            area: "",
            city: "",
            state: "",
            pincode: "",
            landmark: "",
            latitude: "",
            longitude: "",
          },
        }

        let initialStep2 = {
          menuImages: [],
          profileImage: null,
          cuisines: [],
          openingTime: "",
          closingTime: "21:00",
          openDays: [],
        }

        let initialStep3 = {
          panNumber: "",
          nameOnPan: "",
          panImage: null,
          gstRegistered: false,
          gstNumber: "",
          gstLegalName: "",
          gstAddress: "",
          gstImage: null,
          fssaiNumber: "",
          fssaiExpiry: "",
          fssaiImage: null,
          accountNumber: "",
          confirmAccountNumber: "",
          ifscCode: "",
          accountHolderName: "",
          accountType: "",
        }

        let initialStep4 = {
          estimatedDeliveryTime: "",
          featuredDish: "",
          featuredPrice: "",
          offer: "",
        }

        // 2. Overlay Server Data
        if (serverData) {
          onboardingDraftRef.current = serverData
          setIsEditing(serverData.status === "rejected" || serverData.status === "pending" || serverData.status === "onboarding")

          if (serverData.status === "rejected") {
            setIsReonboardBypass(true)
            setTimeout(() => {
              toast.error(`Previous application rejected: ${serverData.rejectionReason || 'Please update your details'}`)
            }, 500)
          } else if (serverData.status !== "onboarding") {
            // Pending/approved profiles — not a fresh onboarding payment flow
            setIsReonboardBypass(true)
          }

          initialStep1 = {
            restaurantName: serverData.name || serverData.restaurantName || "",
            pureVegRestaurant: typeof serverData.pureVegRestaurant === "boolean" ? serverData.pureVegRestaurant : null,
            ownerName: serverData.ownerName || "",
            ownerEmail: serverData.ownerEmail || "",
            ownerPhone: serverData.ownerPhone || verifiedPhone,
            zoneId: normalizeZoneIdValue(serverData.zoneId) || "",
            primaryContactNumber: serverData.primaryContactNumber || verifiedPhone,
            ref: "",
            location: {
              formattedAddress: serverData.location?.formattedAddress || serverData.location?.address || "",
              addressLine1: serverData.location?.addressLine1 || "",
              addressLine2: serverData.location?.addressLine2 || "",
              area: serverData.location?.area || "",
              city: serverData.location?.city || "",
              state: serverData.location?.state || "",
              pincode: serverData.location?.pincode || "",
              landmark: serverData.location?.landmark || "",
              latitude: serverData.location?.latitude ?? "",
              longitude: serverData.location?.longitude ?? "",
            },
          }

          initialStep2 = {
            menuImages: serverData.menuImages || [],
            profileImage: serverData.profileImage || null,
            cuisines: serverData.cuisines || [],
            openingTime: normalizeTimeValue(serverData.openingTime),
            closingTime: normalizeTimeValue(serverData.closingTime),
            openDays: serverData.openDays || [],
          }

          initialStep3 = {
            panNumber: serverData.panNumber || "",
            nameOnPan: serverData.nameOnPan || "",
            panImage: serverData.panImage || null,
            gstRegistered: !!serverData.gstRegistered,
            gstNumber: serverData.gstNumber || "",
            gstLegalName: serverData.gstLegalName || "",
            gstAddress: serverData.gstAddress || "",
            gstImage: serverData.gstImage || null,
            fssaiNumber: serverData.fssaiNumber || "",
            fssaiExpiry: serverData.fssaiExpiry ? String(serverData.fssaiExpiry).split('T')[0] : "",
            fssaiImage: serverData.fssaiImage || null,
            accountNumber: serverData.accountNumber || "",
            confirmAccountNumber: serverData.accountNumber || "",
            ifscCode: (serverData.ifscCode || "").toUpperCase(),
            accountHolderName: serverData.accountHolderName || "",
            accountType: normalizeAccountTypeValue(serverData.accountType || ""),
          }

          initialStep4 = {
            estimatedDeliveryTime: serverData.estimatedDeliveryTime || "",
            featuredDish: serverData.featuredDish || "",
            featuredPrice: serverData.featuredPrice || "",
            offer: serverData.offer || "",
          }
        } else if (!isReonboard) {
          setIsEditing(true)
        }

        // 3. Overlay Local Progress from localStorage / IndexedDB
        const localData = loadOnboardingFromLocalStorage()
        if (localData) {
          if (localData.step1) {
            const serverStep1 = { ...initialStep1 }
            initialStep1 = {
              ...serverStep1,
              ...localData.step1,
              restaurantName: pickNonEmpty(localData.step1.restaurantName, serverStep1.restaurantName),
              pureVegRestaurant:
                typeof localData.step1.pureVegRestaurant === "boolean"
                  ? localData.step1.pureVegRestaurant
                  : serverStep1.pureVegRestaurant,
              ownerName: pickNonEmpty(localData.step1.ownerName, serverStep1.ownerName),
              ownerEmail: pickNonEmpty(localData.step1.ownerEmail, serverStep1.ownerEmail),
              ownerPhone:
                resolveVerifiedOwnerPhone(localData.step1.ownerPhone, serverStep1.ownerPhone) ||
                serverStep1.ownerPhone,
              primaryContactNumber: pickNonEmpty(
                localData.step1.primaryContactNumber,
                serverStep1.primaryContactNumber,
              ),
              zoneId: normalizeZoneIdValue(localData.step1.zoneId) || serverStep1.zoneId,
              location: {
                ...serverStep1.location,
                ...(localData.step1.location || {}),
                formattedAddress: pickNonEmpty(
                  localData.step1.location?.formattedAddress,
                  serverStep1.location?.formattedAddress,
                ),
                addressLine1: pickNonEmpty(
                  localData.step1.location?.addressLine1,
                  serverStep1.location?.addressLine1,
                ),
                addressLine2: pickNonEmpty(
                  localData.step1.location?.addressLine2,
                  serverStep1.location?.addressLine2,
                ),
                area: pickNonEmpty(localData.step1.location?.area, serverStep1.location?.area),
                city: pickNonEmpty(localData.step1.location?.city, serverStep1.location?.city),
                state: pickNonEmpty(localData.step1.location?.state, serverStep1.location?.state),
                pincode: pickNonEmpty(localData.step1.location?.pincode, serverStep1.location?.pincode),
                landmark: pickNonEmpty(localData.step1.location?.landmark, serverStep1.location?.landmark),
                latitude: pickNonEmpty(localData.step1.location?.latitude, serverStep1.location?.latitude),
                longitude: pickNonEmpty(localData.step1.location?.longitude, serverStep1.location?.longitude),
              },
            }
          }
          if (localData.step2) {
            const restoredMenuImages = await Promise.all(
              (localData.step2.menuImages || []).map((img, index) =>
                restoreDraftImage(img, `menu-image-${index + 1}`)
              )
            )
            const filteredMenuImages = restoredMenuImages.filter(Boolean)
            const cachedMenuImages = onboardingFileCache.step2.menuImages || []
            const restoredProfileImage = await restoreDraftImage(
              localData.step2.profileImage,
              "restaurant-profile",
            )
            const cachedProfileImage = onboardingFileCache.step2.profileImage || null

            const localMenuImages = [...filteredMenuImages, ...cachedMenuImages]
            const serverMenuImages = (initialStep2.menuImages || []).filter(hasValidMenuImageAsset)

            initialStep2 = {
              ...initialStep2,
              ...localData.step2,
              menuImages: localMenuImages.length > 0 ? localMenuImages : serverMenuImages,
              profileImage: cachedProfileImage || restoredProfileImage || initialStep2.profileImage,
              openingTime: normalizeTimeValue(localData.step2.openingTime) || initialStep2.openingTime,
              closingTime: normalizeTimeValue(localData.step2.closingTime) || initialStep2.closingTime,
            }
          }
          if (localData.step3) {
            const restoredPanImage = await restoreDraftImage(localData.step3.panImage, "pan-image")
            const restoredGstImage = await restoreDraftImage(localData.step3.gstImage, "gst-image")
            const restoredFssaiImage = await restoreDraftImage(localData.step3.fssaiImage, "fssai-image")
            const serverStep3 = { ...initialStep3 }

            initialStep3 = {
              ...serverStep3,
              ...localData.step3,
              panNumber: pickNonEmpty(localData.step3.panNumber, serverStep3.panNumber),
              nameOnPan: pickNonEmpty(localData.step3.nameOnPan, serverStep3.nameOnPan),
              gstNumber: pickNonEmpty(localData.step3.gstNumber, serverStep3.gstNumber),
              gstLegalName: pickNonEmpty(localData.step3.gstLegalName, serverStep3.gstLegalName),
              gstAddress: pickNonEmpty(localData.step3.gstAddress, serverStep3.gstAddress),
              fssaiNumber: pickNonEmpty(localData.step3.fssaiNumber, serverStep3.fssaiNumber),
              fssaiExpiry: pickNonEmpty(localData.step3.fssaiExpiry, serverStep3.fssaiExpiry),
              accountNumber: pickNonEmpty(localData.step3.accountNumber, serverStep3.accountNumber),
              confirmAccountNumber: pickNonEmpty(
                localData.step3.confirmAccountNumber,
                serverStep3.confirmAccountNumber,
                serverStep3.accountNumber,
              ),
              accountHolderName: pickNonEmpty(
                localData.step3.accountHolderName,
                serverStep3.accountHolderName,
              ),
              accountType: normalizeAccountTypeValue(
                pickNonEmpty(localData.step3.accountType, serverStep3.accountType),
              ),
              gstRegistered:
                typeof localData.step3.gstRegistered === "boolean"
                  ? localData.step3.gstRegistered
                  : serverStep3.gstRegistered,
              panImage: onboardingFileCache.step3.panImage || restoredPanImage || serverStep3.panImage,
              gstImage: onboardingFileCache.step3.gstImage || restoredGstImage || serverStep3.gstImage,
              fssaiImage:
                onboardingFileCache.step3.fssaiImage || restoredFssaiImage || serverStep3.fssaiImage,
              ifscCode: (pickNonEmpty(localData.step3.ifscCode, serverStep3.ifscCode) || "").toUpperCase(),
            }
          }
          if (localData.step4) {
            initialStep4 = {
              ...initialStep4,
              ...localData.step4,
            }
          }
        }

        const finalVerifiedPhone = resolveVerifiedOwnerPhone(
          verifiedPhone,
          initialStep1.ownerPhone,
          serverData?.ownerPhone,
        )
        if (finalVerifiedPhone) {
          initialStep1.ownerPhone = finalVerifiedPhone
          setVerifiedPhoneNumber(finalVerifiedPhone)
        }

        // Apply initialized values to React state
        setStep1(initialStep1)
        setStep2(initialStep2)
        setStep3(initialStep3)
        setStep4(initialStep4)

        // 4. Handle Routing step parameter
        const stepParam = searchParams.get("step")
        let stepToShow = 1
        if (stepParam) {
          const stepNum = parseInt(stepParam, 10)
          if (stepNum >= 1 && stepNum <= 4) {
            stepToShow = stepNum
            setStep(stepNum)
          }
        } else {
          if (localData?.currentStep) {
            stepToShow = localData.currentStep
            hasRestoredDraftStepRef.current = true
          } else if (serverData) {
            if (serverData.status === "onboarding") {
              stepToShow = Math.min(Math.max(Number(serverData.onboardingStep) || 2, 1), 4)
              hasRestoredDraftStepRef.current = true
            } else if (serverData.status === "approved" || serverData.status === "pending") {
              stepToShow = 1
            } else {
              const combinedData = {
                completedSteps: serverData?.onboarding?.completedSteps,
                step1: initialStep1,
                step2: {
                  ...initialStep2,
                  deliveryTimings: {
                    openingTime: initialStep2.openingTime,
                    closingTime: initialStep2.closingTime,
                  },
                  menuImageUrls: initialStep2.menuImages,
                  profileImageUrl: initialStep2.profileImage,
                },
                step3: {
                  pan: {
                    panNumber: initialStep3.panNumber,
                    nameOnPan: initialStep3.nameOnPan,
                    image: initialStep3.panImage,
                  },
                  gst: {
                    isRegistered: !!initialStep3.gstRegistered,
                    gstNumber: initialStep3.gstNumber,
                    legalName: initialStep3.gstLegalName,
                    address: initialStep3.gstAddress,
                    image: initialStep3.gstImage,
                  },
                  fssai: {
                    registrationNumber: initialStep3.fssaiNumber,
                    expiryDate: initialStep3.fssaiExpiry,
                    image: initialStep3.fssaiImage,
                  },
                  bank: {
                    accountNumber: initialStep3.accountNumber,
                    ifscCode: initialStep3.ifscCode,
                    accountHolderName: initialStep3.accountHolderName,
                    accountType: initialStep3.accountType,
                  },
                }
              }
              const determined = determineStepToShow(combinedData)
              stepToShow = determined || 1
            }
          }
          goToStep(stepToShow, { replace: true })
        }
      } catch (err) {
        setIsEditing(true)
        debugError("Error during onboarding initialization:", err)
      } finally {
        setLoading(false)
      }
    }

    initOnboardingData()
  }, [])

  // Sync step parameter changes to the step state without resetting other states
  useEffect(() => {
    const stepParam = searchParams.get("step")
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10)
      if (stepNum >= 1 && stepNum <= 4) {
        setStep(stepNum)
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!verifiedPhoneNumber) return
    setStep1((prev) => {
      if (prev.ownerPhone === verifiedPhoneNumber) return prev
      return { ...prev, ownerPhone: verifiedPhoneNumber }
    })
  }, [verifiedPhoneNumber])

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) {
      setStep1((prev) => ({ ...prev, ref }))
    }
  }, [searchParams])

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return undefined

    const updateInset = () => {
      const vv = window.visualViewport
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height))
      setKeyboardInset(inset > 120 ? inset : 0)
    }

    updateInset()
    window.visualViewport.addEventListener("resize", updateInset)
    window.visualViewport.addEventListener("scroll", updateInset)
    return () => {
      window.visualViewport.removeEventListener("resize", updateInset)
      window.visualViewport.removeEventListener("scroll", updateInset)
    }
  }, [])

  // Save to localStorage whenever step data changes
  useEffect(() => {
    let active = true

      ; (async () => {
        await saveOnboardingToLocalStorage(step1, step2, step3, step4, step)
        if (!active) return
      })()

    return () => {
      active = false
    }
  }, [step1, step2, step3, step4, step])

  useEffect(() => {
    syncOnboardingFileCache(step2, step3)
  }, [step2, step3])

  useEffect(() => {
    return () => {
      previewUrlCacheRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // Ignore revoke errors
        }
      })
      previewUrlCacheRef.current.clear()
    }
  }, [])

  const handleUpload = async (file, folder) => {
    try {
      // Uploading is done on final registration submit (multipart /register).
      // Keep this method for backward compatibility in case other flows call it.
      throw new Error("Image uploads are submitted during registration")
    } catch (err) {
      // Provide more informative error message for upload failures
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image"
      debugError("Upload error:", errorMsg, err)
      throw new Error(`Image upload failed: ${errorMsg}`)
    }
  }

  // Validation functions for each step
  const validateStep1 = () => {
    const errors = []

    if (!step1.restaurantName?.trim()) {
      errors.push("Restaurant name is required")
    }
    if (typeof step1.pureVegRestaurant !== "boolean") {
      errors.push("Please select whether your restaurant is pure veg")
    }
    if (!step1.ownerName?.trim()) {
      errors.push("Owner name is required")
    } else if (!NAME_REGEX.test(step1.ownerName.trim())) {
      errors.push("Owner name must contain only letters")
    }
    if (!step1.ownerEmail?.trim()) {
      errors.push("Owner email is required")
    } else if (!OWNER_EMAIL_REGEX.test(step1.ownerEmail.trim())) {
      errors.push("Email must be a valid @gmail.com address")
    }
    if (!step1.ownerPhone?.trim()) {
      errors.push("Owner phone number is required")
    } else if (!PHONE_NUMBER_REGEX.test(step1.ownerPhone.trim())) {
      errors.push("Owner phone number must be a valid 10 to 12-digit number")
    }
    if (!step1.primaryContactNumber?.trim()) {
      errors.push("Primary contact number is required")
    } else if (!PRIMARY_PHONE_NUMBER_REGEX.test(step1.primaryContactNumber.trim())) {
      errors.push("Primary contact number must contain exactly 10 digits")
    }
    if (!step1.zoneId?.trim()) {
      errors.push("Service zone is required")
    }
    if (!step1.location?.addressLine1?.trim()) {
      errors.push("Building/Floor/Street address is required")
    }
    if (!step1.location?.area?.trim()) {
      errors.push("Area/Sector/Locality is required")
    }
    if (!step1.location?.city?.trim()) {
      errors.push("City is required")
    }
    if (!step1.location?.pincode?.trim()) {
      errors.push("Pincode is required")
    } else if (!PINCODE_REGEX.test(step1.location.pincode.trim())) {
      errors.push("Pincode must contain exactly 6 digits")
    }

    // Geofencing Validation: Ensure coordinates are inside the selected zone
    if (step1.zoneId && step1.location?.latitude && step1.location?.longitude) {
      const selectedZone = zones.find((z) => String(z._id || z.id) === step1.zoneId)
      if (selectedZone && Array.isArray(selectedZone.coordinates) && selectedZone.coordinates.length >= 3) {
        const isInside = isPointInPolygon(
          Number(step1.location.latitude),
          Number(step1.location.longitude),
          selectedZone.coordinates,
        )
        if (!isInside) {
          errors.push("Selected address is outside the selected zone")
        }
      }
    }

    return errors
  }

  const validateStep2 = () => {
    const errors = []

    // Check menu images - must have at least one File or existing URL
    const hasMenuImages = step2.menuImages && step2.menuImages.length > 0
    if (!hasMenuImages) {
      errors.push("At least one menu image is required")
    } else {
      // Verify that menu images are either File objects or have valid URLs
      const validMenuImages = step2.menuImages.filter(img => {
        if (isUploadableFile(img)) return true
        if (img?.url && typeof img.url === 'string') return true
        if (typeof img === 'string' && img.startsWith('http')) return true
        return false
      })
      if (validMenuImages.length === 0) {
        errors.push("Please upload at least one valid menu image")
      }
    }

    // Check profile image - must be a File or existing URL
    if (!step2.profileImage) {
      errors.push("Restaurant profile image is required")
    } else {
      // Verify profile image is either a File or has a valid URL
      const isValidProfileImage =
        isUploadableFile(step2.profileImage) ||
        (step2.profileImage?.url && typeof step2.profileImage.url === 'string') ||
        (typeof step2.profileImage === 'string' && step2.profileImage.startsWith('http'))
      if (!isValidProfileImage) {
        errors.push("Please upload a valid restaurant profile image")
      }
    }

    if (!step2.openingTime?.trim()) {
      errors.push("Opening time is required")
    }
    if (!step2.closingTime?.trim()) {
      errors.push("Closing time is required")
    }
    if (!step2.openDays || step2.openDays.length === 0) {
      errors.push("Please select at least one open day")
    }

    return errors
  }

  const validateStep4 = () => {
    const errors = []
    if (!step4.estimatedDeliveryTime || !step4.estimatedDeliveryTime.trim()) {
      errors.push("Estimated delivery time is required")
    }
    if (!step4.featuredDish || !step4.featuredDish.trim()) {
      errors.push("Featured dish name is required")
    } else if (!FEATURED_DISH_NAME_REGEX.test(step4.featuredDish.trim())) {
      errors.push("Featured dish name must contain only letters")
    }
    return errors
  }

  const validateStep3 = () => {
    const errors = []

    if (!step3.panNumber?.trim()) {
      errors.push("PAN number is required")
    } else if (!PAN_NUMBER_REGEX.test(step3.panNumber.trim().toUpperCase())) {
      errors.push("PAN number must be valid (e.g., ABCDE1234F)")
    }
    if (!step3.nameOnPan?.trim()) {
      errors.push("Name on PAN is required")
    }
    // Validate PAN image - must be a File or existing URL
    if (!step3.panImage) {
      errors.push("PAN image is required")
    } else {
      const isValidPanImage =
        isUploadableFile(step3.panImage) ||
        (step3.panImage?.url && typeof step3.panImage.url === 'string') ||
        (typeof step3.panImage === 'string' && step3.panImage.startsWith('http'))
      if (!isValidPanImage) {
        errors.push("Please upload a valid PAN image")
      }
    }

    if (!step3.fssaiNumber?.trim()) {
      errors.push("FSSAI number is required")
    } else if (!FSSAI_NUMBER_REGEX.test(step3.fssaiNumber.trim())) {
      errors.push("FSSAI number must contain exactly 14 digits")
    }
    if (!step3.fssaiExpiry?.trim()) {
      errors.push("FSSAI expiry date is required")
    } else if (step3.fssaiExpiry < getTodayLocalYMD()) {
      errors.push("FSSAI expiry date cannot be in the past")
    }
    // Validate FSSAI image - must be a File or existing URL
    if (!step3.fssaiImage) {
      errors.push("FSSAI image is required")
    } else {
      const isValidFssaiImage =
        isUploadableFile(step3.fssaiImage) ||
        (step3.fssaiImage?.url && typeof step3.fssaiImage.url === 'string') ||
        (typeof step3.fssaiImage === 'string' && step3.fssaiImage.startsWith('http'))
      if (!isValidFssaiImage) {
        errors.push("Please upload a valid FSSAI image")
      }
    }

    // Validate GST details if GST registered
    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) {
        errors.push("GST number is required when GST registered")
      } else if (!GST_NUMBER_REGEX.test(step3.gstNumber.trim().toUpperCase())) {
        errors.push("GST number must be a valid 15-character GSTIN")
      }
      if (!step3.gstLegalName?.trim()) {
        errors.push("GST legal name is required when GST registered")
      } else if (!GST_LEGAL_NAME_REGEX.test(step3.gstLegalName.trim())) {
        errors.push("GST legal name must contain only letters")
      }
      if (!step3.gstAddress?.trim()) {
        errors.push("GST registered address is required when GST registered")
      }
      // Validate GST image if GST registered
      if (!step3.gstImage) {
        errors.push("GST image is required when GST registered")
      } else {
        const isValidGstImage =
          isUploadableFile(step3.gstImage) ||
          (step3.gstImage?.url && typeof step3.gstImage.url === 'string') ||
          (typeof step3.gstImage === 'string' && step3.gstImage.startsWith('http'))
        if (!isValidGstImage) {
          errors.push("Please upload a valid GST image")
        }
      }
    }

    if (!step3.accountNumber?.trim()) {
      errors.push("Account number is required")
    } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.accountNumber.trim())) {
      errors.push("Account number must contain 9 to 18 digits only")
    }
    if (!step3.confirmAccountNumber?.trim()) {
      errors.push("Please confirm your account number")
    } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.confirmAccountNumber.trim())) {
      errors.push("Confirm account number must contain 9 to 18 digits only")
    }
    if (step3.accountNumber && step3.confirmAccountNumber && step3.accountNumber !== step3.confirmAccountNumber) {
      errors.push("Account number and confirmation do not match")
    }
    if (!step3.ifscCode?.trim()) {
      errors.push("IFSC code is required")
    } else if (!IFSC_CODE_REGEX.test(step3.ifscCode.trim().toUpperCase())) {
      errors.push("IFSC code must contain exactly 11 alphanumeric characters")
    }
    if (!step3.accountHolderName?.trim()) {
      errors.push("Account holder name is required")
    } else if (!ACCOUNT_HOLDER_NAME_REGEX.test(step3.accountHolderName.trim())) {
      errors.push("Account holder name must contain only letters")
    }
    if (!step3.accountType?.trim()) {
      errors.push("Account type is required")
    } else if (!["Saving", "Current"].includes(step3.accountType.trim())) {
      errors.push("Account type must be either Saving or Current")
    }

    return errors
  }

  // Fill dummy data for testing (development mode only)




  const requiresOnboardingFee =
    Boolean(feeConfig?.isActive && Number(feeConfig?.price) > 0 && !isReonboardBypass)

  const getMergedStepsForSubmit = () => {
    const draft = onboardingDraftRef.current
    const draftLocation = draft?.location || {}

    const mergedStep1 = {
      ...step1,
      restaurantName: pickNonEmpty(step1.restaurantName, draft?.restaurantName, draft?.name),
      pureVegRestaurant:
        typeof step1.pureVegRestaurant === "boolean"
          ? step1.pureVegRestaurant
          : (typeof draft?.pureVegRestaurant === "boolean" ? draft.pureVegRestaurant : false),
      ownerName: pickNonEmpty(step1.ownerName, draft?.ownerName),
      ownerEmail: pickNonEmpty(step1.ownerEmail, draft?.ownerEmail),
      ownerPhone: pickNonEmpty(step1.ownerPhone, draft?.ownerPhone, verifiedPhoneNumber),
      primaryContactNumber: pickNonEmpty(step1.primaryContactNumber, draft?.primaryContactNumber),
      zoneId: pickNonEmpty(normalizeZoneIdValue(step1.zoneId), normalizeZoneIdValue(draft?.zoneId)),
      location: {
        ...step1.location,
        formattedAddress: pickNonEmpty(step1.location?.formattedAddress, draftLocation.formattedAddress),
        addressLine1: pickNonEmpty(step1.location?.addressLine1, draftLocation.addressLine1),
        addressLine2: pickNonEmpty(step1.location?.addressLine2, draftLocation.addressLine2),
        area: pickNonEmpty(step1.location?.area, draftLocation.area),
        city: pickNonEmpty(step1.location?.city, draftLocation.city),
        state: pickNonEmpty(step1.location?.state, draftLocation.state),
        pincode: pickNonEmpty(step1.location?.pincode, draftLocation.pincode),
        landmark: pickNonEmpty(step1.location?.landmark, draftLocation.landmark),
        latitude: pickNonEmpty(step1.location?.latitude, draftLocation.latitude),
        longitude: pickNonEmpty(step1.location?.longitude, draftLocation.longitude),
      },
    }

    const mergedStep2 = {
      ...step2,
      cuisines: (step2.cuisines?.length ? step2.cuisines : draft?.cuisines) || [],
      openingTime: pickNonEmpty(step2.openingTime, draft?.openingTime),
      closingTime: pickNonEmpty(step2.closingTime, draft?.closingTime),
      openDays: (step2.openDays?.length ? step2.openDays : draft?.openDays) || [],
      menuImages: (step2.menuImages?.length ? step2.menuImages : draft?.menuImages) || [],
      profileImage: step2.profileImage || draft?.profileImage || null,
    }

    const mergedStep3 = {
      ...step3,
      panNumber: pickNonEmpty(step3.panNumber, draft?.panNumber),
      nameOnPan: pickNonEmpty(step3.nameOnPan, draft?.nameOnPan),
      panImage: step3.panImage || draft?.panImage || null,
      gstRegistered: typeof step3.gstRegistered === "boolean" ? step3.gstRegistered : !!draft?.gstRegistered,
      gstNumber: pickNonEmpty(step3.gstNumber, draft?.gstNumber),
      gstLegalName: pickNonEmpty(step3.gstLegalName, draft?.gstLegalName),
      gstAddress: pickNonEmpty(step3.gstAddress, draft?.gstAddress),
      gstImage: step3.gstImage || draft?.gstImage || null,
      fssaiNumber: pickNonEmpty(step3.fssaiNumber, draft?.fssaiNumber),
      fssaiExpiry: pickNonEmpty(
        step3.fssaiExpiry,
        draft?.fssaiExpiry ? String(draft.fssaiExpiry).split("T")[0] : "",
      ),
      fssaiImage: step3.fssaiImage || draft?.fssaiImage || null,
      accountNumber: pickNonEmpty(step3.accountNumber, draft?.accountNumber),
      ifscCode: pickNonEmpty(step3.ifscCode, draft?.ifscCode),
      accountHolderName: pickNonEmpty(step3.accountHolderName, draft?.accountHolderName),
      accountType: normalizeAccountTypeValue(pickNonEmpty(step3.accountType, draft?.accountType)),
    }

    return { mergedStep1, mergedStep2, mergedStep3 }
  }

  const handleNext = async () => {
    setError("")

    // Validate current step before proceeding
    let validationErrors = []
    if (step === 1) {
      // If coordinates are missing, let's try to geocode the address
      if (!step1.location?.latitude || !step1.location?.longitude) {
        try {
          const apiKey = await getGoogleMapsApiKey()
          if (apiKey) {
            const queryAddress = [
              step1.location?.formattedAddress,
              step1.location?.addressLine1,
              step1.location?.area,
              step1.location?.city,
              step1.location?.state,
              step1.location?.pincode
            ].filter(Boolean).join(", ")

            if (queryAddress.trim()) {
              const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryAddress)}&key=${apiKey}`
              )
              const data = await res.json()
              if (data?.results?.[0]?.geometry?.location) {
                const { lat, lng } = data.results[0].geometry.location
                const latVal = Number(lat.toFixed(6))
                const lngVal = Number(lng.toFixed(6))

                const comps = data.results[0].address_components || []
                const getComp = (types) => comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
                const pCode = getComp(["postal_code"])
                const area = getComp(["sublocality_level_1", "sublocality", "neighborhood"]) || getComp(["locality"])
                const city = getComp(["locality"]) || getComp(["administrative_area_level_2"])
                const state = getComp(["administrative_area_level_1"])

                setStep1((prev) => ({
                  ...prev,
                  location: {
                    ...prev.location,
                    latitude: latVal,
                    longitude: lngVal,
                    area: prev.location.area || area,
                    city: prev.location.city || city,
                    state: prev.location.state || state,
                    pincode: prev.location.pincode || pCode,
                  }
                }))

                step1.location = {
                  ...step1.location,
                  latitude: latVal,
                  longitude: lngVal,
                  area: step1.location.area || area,
                  city: step1.location.city || city,
                  state: step1.location.state || state,
                  pincode: step1.location.pincode || pCode,
                }
                setLocationPickedFromSuggestion(true)
              }
            }
          }
        } catch (e) {
          debugWarn("Failed to geocode address on Next:", e)
        }
      }

      // If coordinates are STILL missing, let's fall back to the selected zone's center!
      if (!step1.location?.latitude || !step1.location?.longitude) {
        if (step1.zoneId) {
          const selectedZone = zones.find((z) => String(z._id || z.id) === step1.zoneId)
          if (selectedZone) {
            const center = getZoneCenter(selectedZone)
            if (center) {
              setStep1((prev) => ({
                ...prev,
                location: {
                  ...prev.location,
                  latitude: center.latitude,
                  longitude: center.longitude
                }
              }))
              step1.location = {
                ...step1.location,
                latitude: center.latitude,
                longitude: center.longitude
              }
              toast.info("Using center coordinates of selected zone for geocoding fallback.")
            }
          }
        }
      }

      validationErrors = validateStep1()
    } else if (step === 2) {
      validationErrors = validateStep2()
    } else if (step === 3) {
      validationErrors = validateStep3()
    } else if (step === 4) {
      validationErrors = validateStep4()
      debugLog('?? Step 4 validation:', {
        step4,
        errors: validationErrors,
        estimatedDeliveryTime: step4.estimatedDeliveryTime,
        featuredDish: step4.featuredDish,
        featuredPrice: step4.featuredPrice,
        offer: step4.offer
      })
    }

    if (validationErrors.length > 0) {
      // Show error toast for each validation error
      validationErrors.forEach((error, index) => {
        setTimeout(() => {
          toast.error(error, {
            duration: 4000,
          })
        }, index * 100)
      })
      debugLog('? Validation failed:', validationErrors)
      return
    }

    setSaving(true)
    try {
      if (step === 1) {
        const formData = buildOnboardingStepFormData(1, { step1, step2, step3 })
        await restaurantAPI.saveOnboardingStep(1, formData)
        goToStep(2)
        window.scrollTo({ top: 0, behavior: "instant" })
      } else if (step === 2) {
        const formData = buildOnboardingStepFormData(2, { step1, step2, step3 })
        await restaurantAPI.saveOnboardingStep(2, formData)
        goToStep(3)
        window.scrollTo({ top: 0, behavior: "instant" })
      } else if (step === 3) {
        const formData = buildOnboardingStepFormData(3, { step1, step2, step3 })
        await restaurantAPI.saveOnboardingStep(3, formData)
        goToStep(4)
        window.scrollTo({ top: 0, behavior: "instant" })
      } else if (step === 4) {
        const { mergedStep1, mergedStep2, mergedStep3 } = getMergedStepsForSubmit()

        if (!mergedStep1.restaurantName?.trim()) {
          throw new Error("Restaurant name is required")
        }

        // Final submit: create restaurant in DB using backend multipart endpoint.
        const formData = new FormData()

        // Step 1
        formData.append("restaurantName", mergedStep1.restaurantName || "")
        formData.append(
          "pureVegRestaurant",
          mergedStep1.pureVegRestaurant === true ? "true" : "false",
        )
        formData.append("ownerName", mergedStep1.ownerName || "")
        formData.append("ownerEmail", (mergedStep1.ownerEmail || "").trim())
        formData.append("ownerPhone", normalizePhoneDigits(mergedStep1.ownerPhone))
        formData.append("primaryContactNumber", normalizePhoneDigits(mergedStep1.primaryContactNumber))
        formData.append("zoneId", mergedStep1.zoneId || "")
        formData.append("addressLine1", mergedStep1.location?.addressLine1 || "")
        formData.append("addressLine2", mergedStep1.location?.addressLine2 || "")
        formData.append("area", mergedStep1.location?.area || "")
        formData.append("city", mergedStep1.location?.city || "")
        formData.append("state", mergedStep1.location?.state || "")
        formData.append("pincode", mergedStep1.location?.pincode || "")
        formData.append("landmark", mergedStep1.location?.landmark || "")
        formData.append("formattedAddress", mergedStep1.location?.formattedAddress || "")
        formData.append("latitude", String(mergedStep1.location?.latitude || ""))
        formData.append("longitude", String(mergedStep1.location?.longitude || ""))
        formData.append("ref", mergedStep1.ref || "")

        // Step 2
        formData.append("cuisines", (mergedStep2.cuisines || []).join(","))
        formData.append("openingTime", normalizeTimeValue(mergedStep2.openingTime) || "")
        formData.append("closingTime", normalizeTimeValue(mergedStep2.closingTime) || "")
        formData.append("openDays", (mergedStep2.openDays || []).join(","))

        const menuFiles = (mergedStep2.menuImages || []).filter((f) => isUploadableFile(f))
        const hasExistingMenuImages = (mergedStep2.menuImages || []).some(hasValidMenuImageAsset)
        if (menuFiles.length === 0 && !hasExistingMenuImages) {
          throw new Error("At least one menu image must be uploaded")
        }
        menuFiles.forEach((file) => formData.append("menuImages", file))

        if (isUploadableFile(mergedStep2.profileImage)) {
          formData.append("profileImage", mergedStep2.profileImage)
        } else if (!hasValidImageAsset(mergedStep2.profileImage)) {
          throw new Error("Restaurant profile image is required")
        }

        // Step 3
        formData.append("panNumber", mergedStep3.panNumber || "")
        formData.append("nameOnPan", mergedStep3.nameOnPan || "")
        if (isUploadableFile(mergedStep3.panImage)) {
          formData.append("panImage", mergedStep3.panImage)
        } else if (!hasValidImageAsset(mergedStep3.panImage)) {
          throw new Error("PAN image is required")
        }

        formData.append("gstRegistered", mergedStep3.gstRegistered ? "true" : "false")
        if (mergedStep3.gstRegistered) {
          formData.append("gstNumber", mergedStep3.gstNumber || "")
          formData.append("gstLegalName", mergedStep3.gstLegalName || "")
          formData.append("gstAddress", mergedStep3.gstAddress || "")
          if (isUploadableFile(mergedStep3.gstImage)) {
            formData.append("gstImage", mergedStep3.gstImage)
          } else if (!hasValidImageAsset(mergedStep3.gstImage)) {
            throw new Error("GST image is required when GST registered")
          }
        }

        formData.append("fssaiNumber", mergedStep3.fssaiNumber || "")
        formData.append("fssaiExpiry", mergedStep3.fssaiExpiry || "")
        if (isUploadableFile(mergedStep3.fssaiImage)) {
          formData.append("fssaiImage", mergedStep3.fssaiImage)
        } else if (!hasValidImageAsset(mergedStep3.fssaiImage)) {
          throw new Error("FSSAI image is required")
        }

        const usesExistingAssets =
          (menuFiles.length === 0 && hasExistingMenuImages) ||
          (!isUploadableFile(mergedStep2.profileImage) && hasValidImageAsset(mergedStep2.profileImage)) ||
          (!isUploadableFile(mergedStep3.panImage) && hasValidImageAsset(mergedStep3.panImage)) ||
          (!isUploadableFile(mergedStep3.fssaiImage) && hasValidImageAsset(mergedStep3.fssaiImage)) ||
          (mergedStep3.gstRegistered && !isUploadableFile(mergedStep3.gstImage) && hasValidImageAsset(mergedStep3.gstImage))

        if (usesExistingAssets || onboardingDraftRef.current?.status === "onboarding") {
          formData.append("finalizeOnboarding", "true")
        }

        formData.append("accountNumber", mergedStep3.accountNumber || "")
        formData.append("ifscCode", (mergedStep3.ifscCode || "").toUpperCase())
        formData.append("accountHolderName", mergedStep3.accountHolderName || "")
        formData.append("accountType", mergedStep3.accountType || "")

        // Step 4
        formData.append("estimatedDeliveryTime", step4.estimatedDeliveryTime || "")
        formData.append("featuredDish", step4.featuredDish || "")
        formData.append("offer", step4.offer || "")

        // Check if onboarding fee config exists, is active, and is greater than 0
        if (requiresOnboardingFee) {
          const orderRes = await onboardingFeeAPI.createOrder({
            role: "RESTAURANT",
            name: mergedStep1.ownerName || mergedStep1.restaurantName,
            phone: normalizePhoneDigits(mergedStep1.ownerPhone),
            email: mergedStep1.ownerEmail || ""
          });
          const orderData = orderRes?.data?.data || orderRes?.data;

          if (!orderData || !orderData.orderId) {
            throw new Error("Failed to create onboarding payment order");
          }

          if (orderData.isMock || orderData.orderId.startsWith("mock_ord_")) {
            toast.success("Developer Mode: Payment bypassed. Submitting mock payment details.");
            formData.append("razorpayOrderId", orderData.orderId);
            formData.append("razorpayPaymentId", `mock_pay_${Date.now()}`);
            formData.append("razorpaySignature", `mock_sig_${Date.now()}`);

            await restaurantAPI.register(formData);

            sessionStorage.removeItem("restaurantReonboard");
            clearOnboardingFromLocalStorage();
            clearOnboardingFileCache();
            try {
              localStorage.setItem("restaurant_pendingPhone", normalizePhoneDigits(mergedStep1.ownerPhone));
            } catch { }

            toast.success("Registration submitted. Awaiting admin approval.", { duration: 4000 });
            navigate("/food/restaurant/pending-verification", {
              replace: true,
              state: {
                phone: normalizePhoneDigits(mergedStep1.ownerPhone),
              },
            });
          } else {
            // Open real Razorpay modal
            setSaving(false); // Enable interactive UI since payment is in progress
            const rzpOptions = {
              key: orderData.keyId,
              amount: Math.round(orderData.amount * 100),
              currency: orderData.currency || "INR",
              order_id: orderData.orderId,
              name: "Onboarding Fee Payment",
              description: `Onboarding fee for ${mergedStep1.restaurantName}`,
              prefill: {
                name: mergedStep1.ownerName || "",
                email: mergedStep1.ownerEmail || "",
                contact: normalizePhoneDigits(mergedStep1.ownerPhone)
              },
              handler: async (response) => {
                try {
                  setSaving(true);
                  formData.append("razorpayOrderId", response.razorpay_order_id);
                  formData.append("razorpayPaymentId", response.razorpay_payment_id);
                  formData.append("razorpaySignature", response.razorpay_signature);

                  await restaurantAPI.register(formData);

                  sessionStorage.removeItem("restaurantReonboard");
                  clearOnboardingFromLocalStorage();
                  clearOnboardingFileCache();
                  try {
                    localStorage.setItem("restaurant_pendingPhone", normalizePhoneDigits(mergedStep1.ownerPhone));
                  } catch { }

                  toast.success("Registration submitted. Awaiting admin approval.", { duration: 4000 });
                  navigate("/food/restaurant/pending-verification", {
                    replace: true,
                    state: {
                      phone: normalizePhoneDigits(mergedStep1.ownerPhone),
                    },
                  });
                } catch (err) {
                  const msg =
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.message ||
                    "Failed to save onboarding data";
                  setError(msg);
                  toast.error(msg);
                } finally {
                  setSaving(false);
                }
              },
              onError: (err) => {
                toast.error(err?.description || "Payment failed. Please try again.");
                setError(err?.description || "Payment failed");
                setSaving(false);
              },
              onClose: () => {
                toast.error("Payment modal closed. Payment is required to complete onboarding.");
                setSaving(false);
              }
            };
            await initRazorpayPayment(rzpOptions);
          }
        } else {
          await restaurantAPI.register(formData);

          sessionStorage.removeItem("restaurantReonboard");
          clearOnboardingFromLocalStorage();
          clearOnboardingFileCache();
          try {
            localStorage.setItem("restaurant_pendingPhone", normalizePhoneDigits(mergedStep1.ownerPhone));
          } catch { }

          toast.success("Registration submitted. Awaiting admin approval.", { duration: 4000 });
          navigate("/food/restaurant/pending-verification", {
            replace: true,
            state: {
              phone: normalizePhoneDigits(mergedStep1.ownerPhone),
            },
          });
        }
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to save onboarding data"
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }



  const toggleDay = (day) => {
    setStep2((prev) => {
      const exists = prev.openDays.includes(day)
      if (exists) {
        return { ...prev, openDays: prev.openDays.filter((d) => d !== day) }
      }
      return { ...prev, openDays: [...prev.openDays, day] }
    })
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Restaurant information</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-700">Restaurant name*</Label>
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/[^A-Za-z ]/g, "")
                setStep1({ ...step1, restaurantName: val })
              }}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Customers will see this name"
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Pure veg restaurant?*</Label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => isEditing && setStep1({ ...step1, pureVegRestaurant: true })}
                className={`px-3 py-1.5 text-xs rounded-full border ${step1.pureVegRestaurant === true
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-200"
                  } ${!isEditing ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                Yes, Pure Veg
              </button>
              <button
                type="button"
                onClick={() => isEditing && setStep1({ ...step1, pureVegRestaurant: false })}
                className={`px-3 py-1.5 text-xs rounded-full border ${step1.pureVegRestaurant === false
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200"
                  } ${!isEditing ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                No, Mixed Menu
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              This helps users filter restaurants by dietary preference.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Owner details</h2>
        <p className="text-sm text-gray-600 mb-4">
          These details will be used for all business communications and updates.
        </p>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Full name*</Label>
            <Input
              value={step1.ownerName || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/[^A-Za-z ]/g, "")
                setStep1({ ...step1, ownerName: val })
              }}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Owner full name"
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Email address*</Label>
            <Input
              type="email"
              value={step1.ownerEmail || ""}
              onChange={(e) => setStep1({ ...step1, ownerEmail: e.target.value })}
              onBlur={(e) =>
                setStep1((prev) => ({
                  ...prev,
                  ownerEmail: String(e.target.value || "").trim().toLowerCase(),
                }))
              }
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="owner@example.com"
              inputMode="email"
              pattern={OWNER_EMAIL_REGEX.source}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Phone number*</Label>
            <Input
              type="tel"
              value={step1.ownerPhone || verifiedPhoneNumber || ""}
              readOnly={Boolean(verifiedPhoneNumber)}
              maxLength={10}
              className="mt-1 bg-gray-50 text-sm text-black placeholder-black cursor-not-allowed"
              placeholder="Owner phone number"
              disabled={Boolean(verifiedPhoneNumber)}
            />
            {verifiedPhoneNumber ? (
              <p className="text-[11px] text-gray-500 mt-1">
                This is your OTP-verified number and cannot be changed.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant contact & location</h2>
        <div>
          <Label className="text-xs text-gray-700">Primary contact number*</Label>
          <Input
            type="tel"
            value={step1.primaryContactNumber || ""}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, primaryContactNumber: val })
            }}
            onKeyDown={(e) => {
              const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"]
              if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault()
              if (/^\d$/.test(e.key) && (step1.primaryContactNumber || "").length >= 10) e.preventDefault()
            }}
            onPaste={(e) => {
              e.preventDefault()
              const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, primaryContactNumber: pasted })
            }}
            maxLength={10}
            inputMode="numeric"
            className="mt-1 bg-white text-sm text-black placeholder-black"
            placeholder="Primary contact number (10 digits)"
            disabled={!isEditing}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Customers, delivery partners and {companyName} may call on this number for order
            support.
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Add your restaurant's location for order pick-up.
          </p>
          <div>
            <Label className="text-xs text-gray-700">Service zone*</Label>
            <select
              value={step1.zoneId || ""}
              onChange={(e) => setStep1({ ...step1, zoneId: e.target.value })}
              className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
              disabled={zonesLoading || !isEditing}
            >
              <option value="">{zonesLoading ? "Loading zones..." : "Select a zone"}</option>
              {zones.map((z) => {
                const id = String(z?._id || z?.id || "")
                const label = z?.name || z?.zoneName || z?.serviceLocation || id
                return (
                  <option key={id} value={id}>
                    {label}
                  </option>
                )
              })}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Choose the service zone where your restaurant will be available.
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-700">Search location</Label>
            <Input
              ref={locationSearchInputRef}
              className="mt-1 bg-white text-sm text-black! dark:text-white! placeholder:text-gray-500 dark:placeholder:text-gray-400 caret-black dark:caret-white"
              style={{ color: "#000", WebkitTextFillColor: "#000" }}
              placeholder="Start typing your restaurant address..."
              onChange={(e) => {
                // Jab user manually type kare (suggestion nahi aaya) toh
                // typed text ko formattedAddress mein save karo fallback ke liye
                const typed = e.target.value
                setLocationPickedFromSuggestion(false)
                if (typed) {
                  setStep1((prev) => ({
                    ...prev,
                    location: {
                      ...prev.location,
                      formattedAddress: typed,
                    }
                  }))
                }
              }}
            />
            {/* Warning: manual entry ke baad suggestion nahi chuna */}
            {step1.location?.formattedAddress &&
              !locationPickedFromSuggestion &&
              !step1.location?.latitude && (
                <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Please select a suggestion from the dropdown for accurate location. Manual entry may cause delivery issues.</span>
                </p>
              )}
            {locationPickedFromSuggestion && (
              <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                <span>✅</span>
                <span>Location confirmed from suggestion.</span>
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              Select a suggestion to auto-fill area/city/state/pincode and coordinates.
            </p>
          </div>
          <Input
            value={step1.location?.addressLine1 || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, addressLine1: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Shop no. / building no. (optional)"
          />
          <Input
            value={step1.location?.addressLine2 || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, addressLine2: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Floor / tower (optional)"
          />
          <Input
            value={step1.location?.landmark || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, landmark: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Nearby landmark (optional)"
          />
          <Input
            value={step1.location?.area || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, area: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Area / Sector / Locality*"
          />
          <Input
            value={step1.location?.city || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, city: e.target.value.replace(/[^A-Za-z ]/g, "") },
              })
            }
            className="bg-white text-sm"
            placeholder="City"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={step1.location?.state || ""}
              onChange={(e) =>
                setStep1({
                  ...step1,
                  location: { ...step1.location, state: e.target.value.replace(/[^A-Za-z ]/g, "") },
                })
              }
              className="bg-white text-sm"
              placeholder="State"
            />
            <Input
              value={step1.location?.pincode || ""}
              onChange={(e) =>
                setStep1({
                  ...step1,
                  location: { ...step1.location, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) },
                })
              }
              className="bg-white text-sm"
              placeholder="Pincode"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Please ensure that this address is the same as mentioned on your FSSAI license.
          </p>
        </div>
      </section>
    </div>
  )

  // Initialize Google Places Autocomplete for Step 1 location search.
  useEffect(() => {
    if (step !== 1 || loading || !isEditing) return

    let cancelled = false

    const init = async () => {
      // Wait for the ref to be attached after loading finishes
      for (let i = 0; i < 60; i++) {
        if (locationSearchInputRef.current) break
        await new Promise((r) => setTimeout(r, 50))
      }
      if (!locationSearchInputRef.current || cancelled) return

      const loadMaps = async () => {
        if (mapsScriptLoadedRef.current && window.google?.maps?.places?.Autocomplete) return true
        if (window.google?.maps?.places?.Autocomplete) {
          mapsScriptLoadedRef.current = true
          return true
        }
        const apiKey = await getGoogleMapsApiKey()
        if (!apiKey) return false

        const existing = document.getElementById("restaurant-onboarding-maps-script")
        if (existing) {
          for (let i = 0; i < 30; i += 1) {
            if (window.google?.maps?.places?.Autocomplete) {
              mapsScriptLoadedRef.current = true
              return true
            }
            await new Promise((r) => setTimeout(r, 100))
          }
          return false
        }

        await new Promise((resolve, reject) => {
          const script = document.createElement("script")
          script.id = "restaurant-onboarding-maps-script"
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`
          script.async = true
          script.defer = true
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
        mapsScriptLoadedRef.current = true
        return !!window.google?.maps?.places?.Autocomplete
      }

      const parsePlace = (place) => {
        const formattedAddress = place?.formatted_address || ""
        const comps = Array.isArray(place?.address_components) ? place.address_components : []
        const get = (types) => comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
        const area =
          get(["sublocality_level_1", "sublocality", "neighborhood"]) ||
          get(["locality"])
        const city =
          get(["locality"]) ||
          get(["administrative_area_level_2"])
        const state = get(["administrative_area_level_1"])
        const pincode = get(["postal_code"])
        const lat = place?.geometry?.location?.lat?.()
        const lng = place?.geometry?.location?.lng?.()
        return {
          formattedAddress,
          area,
          city,
          state,
          pincode,
          latitude: Number.isFinite(lat) ? Number(lat.toFixed(6)) : "",
          longitude: Number.isFinite(lng) ? Number(lng.toFixed(6)) : "",
        }
      }

      const ok = await loadMaps()
      if (!ok || cancelled || !locationSearchInputRef.current) return

      // Clean up any previous instance before re-attaching
      if (placesAutocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(placesAutocompleteRef.current)
        placesAutocompleteRef.current = null
      }

      placesAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        locationSearchInputRef.current,
        {
          fields: ["formatted_address", "address_components", "geometry"],
          componentRestrictions: { country: "in" },
        }
      )

      placesAutocompleteRef.current.addListener("place_changed", () => {
        const place = placesAutocompleteRef.current.getPlace()
        const parsed = parsePlace(place)

        // Immediate Geofencing Check
        setStep1((prev) => {
          if (prev.zoneId && parsed.latitude && parsed.longitude) {
            // Access latest zones from state
            const selectedZone = zones.find((z) => String(z._id || z.id) === prev.zoneId)
            if (
              selectedZone &&
              Array.isArray(selectedZone.coordinates) &&
              selectedZone.coordinates.length >= 3
            ) {
              const isInside = isPointInPolygon(
                Number(parsed.latitude),
                Number(parsed.longitude),
                selectedZone.coordinates,
              )
              if (!isInside) {
                toast.error("Selected address is outside the selected zone")
                // Clear search input if outside
                if (locationSearchInputRef.current) {
                  locationSearchInputRef.current.value = ""
                }
                setLocationPickedFromSuggestion(false)
                return prev
              }
            }
          }

          // Mark as picked from suggestion (has coordinates)
          setLocationPickedFromSuggestion(true)

          return {
            ...prev,
            location: {
              ...prev.location,
              formattedAddress: parsed.formattedAddress || prev.location.formattedAddress,
              addressLine1: prev.location.addressLine1 || parsed.formattedAddress || "",
              area: parsed.area || prev.location.area,
              city: parsed.city || prev.location.city,
              state: parsed.state || prev.location.state,
              pincode: parsed.pincode || prev.location.pincode,
              latitude: parsed.latitude !== "" ? parsed.latitude : prev.location.latitude,
              longitude: parsed.longitude !== "" ? parsed.longitude : prev.location.longitude,
            },
          }
        })
      })
    }

    init().catch((err) => {
      debugWarn("Failed to load Google Places for onboarding:", err)
    })

    return () => {
      cancelled = true
      if (placesAutocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(placesAutocompleteRef.current)
      }
      placesAutocompleteRef.current = null
    }
  }, [step, loading, isEditing, zones])

  // Load zones for onboarding dropdown (public endpoint).
  useEffect(() => {
    if (step !== 1) return
    let cancelled = false
    setZonesLoading(true)
    zoneAPI.getPublicZones()
      .then((res) => {
        const list = res?.data?.data?.zones || res?.data?.zones || []
        if (!cancelled) setZones(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setZones([])
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false)
      })
    return () => { cancelled = true }
  }, [step])

  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Images section */}
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <h2 className="text-lg font-semibold text-black">Menu & photos</h2>
        <p className="text-xs text-gray-500">
          Add clear photos of your printed menu and a primary profile image. This helps customers
          understand what you serve.
        </p>

        {/* Menu images */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Menu images</Label>
          <div className="mt-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3 flex items-center justify-between flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-white flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-900">Upload menu images</span>
                <span className="text-[11px] text-gray-500">
                  JPG, PNG, WebP ? You can select multiple files
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() =>
                openOnboardingImagePicker({
                  title: "Add menu image",
                  fallbackInputRef: menuImagesInputRef,
                  fileNamePrefix: "menu-image",
                  onSelectFile: (file) =>
                    setStep2((prev) => ({
                      ...prev,
                      menuImages: [...(prev.menuImages || []), file],
                    })),
                })
              }
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
            </Button>
            <input
              id="menuImagesInput"
              type="file"
              multiple
              accept={LOCAL_IMAGE_FILE_ACCEPT}
              className="hidden"
              ref={menuImagesInputRef}
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                debugLog('?? Menu images selected:', files.length, 'files')
                setStep2((prev) => ({
                  ...prev,
                  menuImages: [...(prev.menuImages || []), ...files], // Append new files to existing ones
                }))
                // Reset input to allow selecting same file again
                e.target.value = ''
              }}
            />
          </div>

          {/* Menu image previews */}
          {!!step2.menuImages.length && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {step2.menuImages.map((file, idx) => {
                // Handle both File objects and URL objects
                let imageUrl = null
                let imageName = `Image ${idx + 1}`

                if (isUploadableFile(file)) {
                  imageUrl = getPreviewImageUrl(file)
                  imageName = file.name || imageName
                } else if (file?.url) {
                  // If it's an object with url property (from backend)
                  imageUrl = file.url
                  imageName = file.name || `Image ${idx + 1}`
                } else if (typeof file === 'string') {
                  // If it's a direct URL string
                  imageUrl = file
                }

                return (
                  <div
                    key={idx}
                    className="relative aspect-4/5 rounded-md overflow-hidden bg-gray-100"
                  >
                    <div className="absolute top-1 right-1 z-30">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setStep2((prev) => ({
                            ...prev,
                            menuImages: prev.menuImages.filter((_, i) => i !== idx),
                          }));
                        }}
                        className="bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={`Menu ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-500 px-2 text-center">
                        Preview unavailable
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                      <p className="text-[10px] text-white truncate">
                        {imageName}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Profile image */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Restaurant profile image</Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {step2.profileImage ? (
                  (() => {
                    const imageSrc = getPreviewImageUrl(step2.profileImage)

                    return imageSrc ? (
                      <img
                        src={imageSrc}
                        alt="Restaurant profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-500" />
                    );
                  })()
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-500" />
                )}
              </div>
              {step2.profileImage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setStep2((prev) => ({
                      ...prev,
                      profileImage: null,
                    }));
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex-1 flex-col flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-900">Upload profile image</span>
                <span className="text-[11px] text-gray-500">
                  This will be shown on your listing card and restaurant page.
                </span>
              </div>

            </div>

          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full text-xs"
            onClick={() =>
              openOnboardingImagePicker({
                title: "Upload profile image",
                fallbackInputRef: profileImageInputRef,
                fileNamePrefix: "restaurant-profile",
                onSelectFile: (file) =>
                  setStep2((prev) => ({
                    ...prev,
                    profileImage: file,
                  })),
              })
            }
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload
          </Button>
          <input
            id="profileImageInput"
            type="file"
            accept={LOCAL_IMAGE_FILE_ACCEPT}
            className="hidden"
            ref={profileImageInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                debugLog('?? Profile image selected:', file.name)
                setStep2((prev) => ({
                  ...prev,
                  profileImage: file,
                }))
              }
              // Reset input to allow selecting same file again
              e.target.value = ''
            }}
          />
        </div>
      </section>

      {/* Operational details */}
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        {/* Timings with popover time selectors */}
        <div className="space-y-3">
          <Label className="text-xs text-gray-700">Delivery timings</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimeSelector
              label="Opening time"
              value={step2.openingTime || ""}
              onChange={(val) =>
                setStep2((prev) => ({ ...prev, openingTime: normalizeTimeValue(val) || "" }))
              }
            />
            <TimeSelector
              label="Closing time"
              value={step2.closingTime || ""}
              onChange={(val) =>
                setStep2((prev) => ({ ...prev, closingTime: normalizeTimeValue(val) || "" }))
              }
            />
          </div>
        </div>

        {/* Open days in a calendar-like grid */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-700 flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-gray-800" />
            <span>Open days</span>
          </Label>
          <p className="text-[11px] text-gray-500">
            Select the days your restaurant accepts delivery orders.
          </p>
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">PAN details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-700">PAN number</Label>
            <Input
              value={step3.panNumber || ""}
              onChange={(e) => {
                const normalized = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 10)
                setStep3({ ...step3, panNumber: normalized })
              }}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="ABCDE1234F"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">PAN Card Holder Name</Label>
            <Input
              value={step3.nameOnPan || ""}
              onChange={(e) =>
                setStep3({
                  ...step3,
                  nameOnPan: e.target.value.replace(/[^A-Za-z ]/g, ""),
                })
              }
              className="mt-1 bg-white text-sm text-black placeholder-black"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-700">PAN image</Label>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full text-xs"
            onClick={() =>
              openOnboardingImagePicker({
                title: "Upload PAN image",
                fallbackInputRef: panImageInputRef,
                fileNamePrefix: "pan-image",
                onSelectFile: (file) =>
                  setStep3((prev) => ({ ...prev, panImage: file })),
              })
            }
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload
          </Button>
          <input
            type="file"
            accept={GALLERY_IMAGE_ACCEPT}
            className="hidden"
            ref={panImageInputRef}
            onChange={(e) =>
              setStep3((prev) => ({ ...prev, panImage: e.target.files?.[0] || null }))
            }
          />
          {step3.panImage && (
            <div className="mt-3 relative aspect-4/3 rounded-md overflow-hidden bg-gray-100">
              {getPreviewImageUrl(step3.panImage) ? (
                <img
                  src={getPreviewImageUrl(step3.panImage)}
                  alt="PAN document"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  Preview unavailable
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setStep3((prev) => ({ ...prev, panImage: null }))
                }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">GST details</h2>
        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">GST registered?</span>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: true })}
            className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"
              }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: false })}
            className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"
              }`}
          >
            No
          </button>
        </div>
        {step3.gstRegistered && (
          <div className="space-y-3">
            <Input
              value={step3.gstNumber || ""}
              onChange={(e) =>
                setStep3({
                  ...step3,
                  gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15),
                })
              }
              className="bg-white text-sm"
              placeholder="GST number (15 characters)"
            />
            <Input
              value={step3.gstLegalName || ""}
              onChange={(e) =>
                setStep3({
                  ...step3,
                  gstLegalName: e.target.value.replace(/[^A-Za-z ]/g, ""),
                })
              }
              className="bg-white text-sm"
              placeholder="Legal name"
            />
            <Input
              value={step3.gstAddress || ""}
              onChange={(e) => setStep3({ ...step3, gstAddress: e.target.value })}
              className="bg-white text-sm"
              placeholder="Registered address"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() =>
                openOnboardingImagePicker({
                  title: "Upload GST certificate",
                  fallbackInputRef: gstImageInputRef,
                  fileNamePrefix: "gst-image",
                  onSelectFile: (file) =>
                    setStep3((prev) => ({ ...prev, gstImage: file })),
                })
              }
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
            </Button>
            <input
              type="file"
              accept={GALLERY_IMAGE_ACCEPT}
              className="hidden"
              ref={gstImageInputRef}
              onChange={(e) =>
                setStep3((prev) => ({ ...prev, gstImage: e.target.files?.[0] || null }))
              }
            />
            {step3.gstImage && (
              <div className="mt-3 relative aspect-4/3 rounded-md overflow-hidden bg-gray-100">
                {getPreviewImageUrl(step3.gstImage) ? (
                  <img
                    src={getPreviewImageUrl(step3.gstImage)}
                    alt="GST document"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                    Preview unavailable
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setStep3((prev) => ({ ...prev, gstImage: null }))
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">FSSAI details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            value={step3.fssaiNumber || ""}
            onChange={(e) =>
              setStep3({ ...step3, fssaiNumber: e.target.value.replace(/\D/g, "").slice(0, 14) })
            }
            className="bg-white text-sm"
            placeholder="FSSAI number (14 digits)"
          />
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date</Label>
            <Popover open={isFssaiCalendarOpen} onOpenChange={setIsFssaiCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsFssaiCalendarOpen(true)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <span className={step3.fssaiExpiry ? "text-gray-900" : "text-gray-500"}>
                    {step3.fssaiExpiry
                      ? parseLocalYMDDate(step3.fssaiExpiry)?.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                      : "Select expiry date"}
                  </span>
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-100" align="start">
                <div className="bg-white rounded-md shadow-lg border border-gray-200">
                  <Calendar
                    mode="single"
                    selected={parseLocalYMDDate(step3.fssaiExpiry)}
                    disabled={(date) => formatDateToLocalYMD(date) < getTodayLocalYMD()}
                    onSelect={(date) => {
                      if (date && formatDateToLocalYMD(date) >= getTodayLocalYMD()) {
                        const formattedDate = formatDateToLocalYMD(date)
                        setStep3({ ...step3, fssaiExpiry: formattedDate })
                        setIsFssaiCalendarOpen(false)
                      }
                    }}
                    initialFocus
                    classNames={{
                      today: "bg-transparent text-foreground border-none", // Remove today highlight
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full text-xs"
          onClick={() =>
            openOnboardingImagePicker({
              title: "Upload FSSAI image",
              fallbackInputRef: fssaiImageInputRef,
              fileNamePrefix: "fssai-image",
              onSelectFile: (file) =>
                setStep3((prev) => ({ ...prev, fssaiImage: file })),
            })
          }
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Upload
        </Button>
        <input
          type="file"
          accept={GALLERY_IMAGE_ACCEPT}
          className="hidden"
          ref={fssaiImageInputRef}
          onChange={(e) =>
            setStep3((prev) => ({ ...prev, fssaiImage: e.target.files?.[0] || null }))
          }
        />
        {step3.fssaiImage && (
          <div className="mt-3 relative aspect-4/3 rounded-md overflow-hidden bg-gray-100">
            {getPreviewImageUrl(step3.fssaiImage) ? (
              <img
                src={getPreviewImageUrl(step3.fssaiImage)}
                alt="FSSAI document"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                Preview unavailable
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setStep3((prev) => ({ ...prev, fssaiImage: null }))
              }}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Bank account details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            value={step3.accountNumber || ""}
            onChange={(e) =>
              setStep3({ ...step3, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 18) })
            }
            className="bg-white text-sm"
            placeholder="Account number"
          />
          <Input
            value={step3.confirmAccountNumber || ""}
            onChange={(e) =>
              setStep3({
                ...step3,
                confirmAccountNumber: e.target.value.replace(/\D/g, "").slice(0, 18),
              })
            }
            className="bg-white text-sm"
            placeholder="Re-enter account number"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            value={step3.ifscCode || ""}
            onChange={(e) =>
              setStep3({
                ...step3,
                ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11),
              })
            }
            className="bg-white text-sm"
            placeholder="IFSC code"
          />
          <Select
            value={step3.accountType || ""}
            onValueChange={(value) => setStep3({ ...step3, accountType: value })}
          >
            <SelectTrigger className="bg-white text-sm">
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Saving">Saving</SelectItem>
              <SelectItem value="Current">Current</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={step3.accountHolderName || ""}
          onChange={(e) =>
            setStep3({
              ...step3,
              accountHolderName: e.target.value.replace(/[^A-Za-z ]/g, ""),
            })
          }
          className="bg-white text-sm"
          placeholder="Account holder name"
        />
      </section>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant Display Information</h2>
        <p className="text-sm text-gray-600">
          Add information that will be displayed to customers on the home page
        </p>

        <div>
          <Label className="text-xs text-gray-700">Estimated Delivery Time*</Label>
          <Select
            value={step4.estimatedDeliveryTime || ""}
            onValueChange={(value) => setStep4({ ...step4, estimatedDeliveryTime: value })}
          >
            <SelectTrigger className="mt-1 bg-white text-sm">
              <SelectValue placeholder="Select estimated timing" />
            </SelectTrigger>
            <SelectContent>
              {[
                ...ESTIMATED_DELIVERY_TIME_OPTIONS,
                ...(step4.estimatedDeliveryTime &&
                  !ESTIMATED_DELIVERY_TIME_OPTIONS.includes(step4.estimatedDeliveryTime)
                  ? [step4.estimatedDeliveryTime]
                  : []),
              ].map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-700">Featured Dish Name*</Label>
          <Input
            value={step4.featuredDish || ""}
            onChange={(e) =>
              setStep4({
                ...step4,
                featuredDish: e.target.value.replace(/[^A-Za-z ]/g, ""),
              })
            }
            className="mt-1 bg-white text-sm"
            placeholder="e.g., Butter Chicken Special"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-700">Special Offer/Promotion</Label>
          <Input
            value={step4.offer || ""}
            onChange={(e) => setStep4({ ...step4, offer: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., Flat 50 Rs. OFF on Order Above Rs.199"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Optional. Leave this blank if you do not want to highlight an offer.
          </p>
        </div>
      </section>

      {fetchingFees && !feeConfig && (
        <section className="bg-white border border-gray-200 p-4 sm:p-6 rounded-md">
          <p className="text-sm text-gray-600">Loading onboarding fee details...</p>
        </section>
      )}

      {requiresOnboardingFee && (
        <section className="bg-amber-50 border border-amber-200 p-4 sm:p-6 rounded-md space-y-3">
          <h2 className="text-lg font-semibold text-amber-900">Onboarding fee</h2>
          <p className="text-sm text-amber-800">
            Admin has set a one-time onboarding fee for restaurant registration. Payment is required before your application can be submitted for approval.
          </p>
          <div className="rounded-md bg-white border border-amber-100 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Amount payable</p>
              <p className="text-2xl font-bold text-gray-900">₹{Number(feeConfig.price).toLocaleString("en-IN")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Payment method</p>
              <p className="text-sm font-medium text-gray-800">Secure online payment</p>
            </div>
          </div>
          <p className="text-xs text-amber-700">
            When you click <span className="font-semibold">Finish</span>, you will be redirected to complete this payment. Your registration will be submitted only after successful payment.
          </p>
        </section>
      )}
    </div>
  )

  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    if (step === 3) return renderStep3()
    return renderStep4()
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white flex items-center justify-between border-b">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (step > 1) {
                  goToStep(step - 1)
                  window.scrollTo({ top: 0, behavior: "instant" })
                } else {
                  handleLogout()
                }
              }}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label={step > 1 ? "Go back" : "Close onboarding"}
            >
              {step > 1 ? (
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              ) : (
                <X className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <div className="text-sm font-semibold text-black">Restaurant onboarding</div>
          </div>
          <div className="flex items-center gap-3">
            {!loading && !isEditing && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="text-xs bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 flex items-center gap-1.5"
                title="Edit Details"
              >
                <Sparkles className="w-3 h-3" />
                Edit Details
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-right">
                Step {step} of 4
              </div>
              <Button
                onClick={handleLogout}
                disabled={isLoggingOut}
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

        </header>

        <main
          className="flex-1 px-4 sm:px-6 py-4 space-y-4"
          style={{ paddingBottom: keyboardInset ? `${keyboardInset + 20}px` : undefined }}
          onFocusCapture={(e) => {
            const target = e.target
            if (!(target instanceof HTMLElement)) return
            if (!target.matches("input, textarea, select")) return
            window.setTimeout(() => {
              target.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 250)
          }}
        >
          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : (
            <div className={!isEditing ? "pointer-events-none select-none" : ""}>
              {renderStep()}
            </div>
          )}
        </main>

        <ImageSourcePicker
          isOpen={sourcePicker.isOpen}
          onClose={closeImageSourcePicker}
          onFileSelect={sourcePicker.onSelectFile}
          title={sourcePicker.title}
          fileNamePrefix={sourcePicker.fileNamePrefix}
          galleryInputRef={sourcePicker.fallbackInputRef}
        />

        {error && (
          <div className="px-4 sm:px-6 pb-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <footer className={`px-4 sm:px-6 py-3 bg-white ${keyboardInset ? "hidden" : ""}`}>
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              disabled={step === 1 || saving}
              onClick={() => { goToStep(step - 1); window.scrollTo({ top: 0, behavior: "instant" }) }}
              className="text-sm text-gray-700 bg-transparent"
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={saving || (step === 4 && !isEditing)}
              className={`text-sm bg-black text-white px-6 ${(step === 4 && !isEditing) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {step === 4
                ? saving
                  ? "Saving..."
                  : requiresOnboardingFee
                    ? `Pay ₹${Number(feeConfig.price).toLocaleString("en-IN")} & Finish`
                    : "Finish"
                : saving
                  ? "Saving..."
                  : "Continue"}
            </Button>
          </div>
        </footer>
      </div>
    </LocalizationProvider>
  )
}



