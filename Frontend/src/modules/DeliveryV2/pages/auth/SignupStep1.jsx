import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image as ImageIcon, Truck } from "lucide-react"
import { toast } from "sonner"
import { openCamera, openGallery } from "@food/utils/imageUploadUtils"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
import { usePorterHomeData } from "../../../porter/user/hooks/usePorterHomeData"
import { deliveryAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const DB_NAME = "DeliverySignupDB"
const STORE_NAME = "documents"

let cachedDB = null
const initDB = () => {
  return new Promise((resolve) => {
    if (cachedDB) {
      return resolve(cachedDB)
    }
    // WebView mein indexedDB available nahi bhi ho sakta
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return resolve(null)
    }
    // Safety timeout: WebView mein indexedDB.open() kabhi kabhi hang karta hai
    // 2 seconds ke baad null return kar do taaki UI stuck na rahe
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



export default function SignupStep1() {
  const navigate = useNavigate()
  const goBack = useDeliveryBackNavigation()
  const { vehicles: porterVehicles } = usePorterHomeData()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const queryRef = searchParams.get("ref") || ""

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("deliverySignupDetails")
    const base = {
      name: "",
      phone: "",
      countryCode: "+91",
      ref: queryRef,
      email: "",
      address: "",
      city: "",
      state: "",
      vehicles: [],
      drivingLicenseNumber: "",
      panNumber: "",
      aadharNumber: ""
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Ensure vehicles is an array even if old data had vehicleType
        const vehicles = Array.isArray(parsed.vehicles) ? parsed.vehicles : [];
        return { ...base, ...parsed, ref: parsed.ref || queryRef, vehicles }
      } catch (e) {
        debugError("Error parsing saved details:", e)
      }
    }
    return base
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState({
    vehicleId: "",
    registrationNumber: "",
    model: ""
  })

  const handleAddVehicle = () => {
    if (!newVehicle.vehicleId) {
      toast.error("Please select a vehicle category");
      return;
    }
    
    const selectedMaster = porterVehicles.find(v => v.id === newVehicle.vehicleId);
    if (!selectedMaster) return;

    const isBicycle = selectedMaster.category?.toLowerCase() === "bicycle";
    // Future ready registration requirement
    const registrationRequired = !isBicycle;

    if (registrationRequired) {
      const normalizedReg = newVehicle.registrationNumber.trim().toUpperCase();
      if (!normalizedReg) {
        toast.error("Registration Number is required for this vehicle");
        return;
      }

      if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(normalizedReg)) {
        toast.error("Invalid Indian vehicle number format (e.g., MH12AB1234)");
        return;
      }

      const isDuplicate = formData.vehicles.some(v => v.registrationNumber === normalizedReg);
      if (isDuplicate) {
        toast.error("This vehicle number is already added to your list");
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      vehicles: [...prev.vehicles, {
        id: Date.now().toString(),
        vehicleId: newVehicle.vehicleId,
        registrationNumber: newVehicle.registrationNumber.trim().toUpperCase(),
        model: newVehicle.model.trim(),
        status: "Draft"
      }]
    }));

    setNewVehicle({ vehicleId: "", registrationNumber: "", model: "" });
    setShowAddVehicle(false);
    toast.success("Vehicle added successfully");
    if (errors.vehicles) {
      setErrors(prev => ({ ...prev, vehicles: "" }));
    }
  }

  const handleRemoveVehicle = (id) => {
    setFormData(prev => ({
      ...prev,
      vehicles: prev.vehicles.filter(v => v.id !== id)
    }));
  }

  const sanitizeLocationValue = (value) =>
    value.replace(/[^A-Za-z\s.-]/g, "").replace(/\s{2,}/g, " ")

  const sanitizeNameValue = (value) =>
    value.replace(/[^A-Za-z\s]/g, "").replace(/\s{2,}/g, " ")

  const isValidLocationValue = (value) =>
    /^[A-Za-z][A-Za-z\s.-]*[A-Za-z.]$/.test(value.trim())

  const isValidNameValue = (value) =>
    /^[A-Za-z][A-Za-z\s]*[A-Za-z]$/.test(value.trim())

  const isValidEmailValue = (value) => {
    const normalizedValue = value.trim().toLowerCase()
    // General email regex
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizedValue)) {
      return false
    }

    const [, domain = ""] = normalizedValue.split("@")
    
    // Catch common typos for Gmail
    const gmailTypos = [
      "gnail.com", "gmal.com", "gmaill.com", "gamil.com", "gmial.com", 
      "gmail.co", "gmail.con", "gmail.cm", "g-mail.com"
    ]
    
    if (gmailTypos.includes(domain)) {
      return false
    }

    // If it starts with gmail. but isn't gmail.com (e.g. gmail.in is usually not a thing)
    if (domain.startsWith("gmail.") && domain !== "gmail.com") {
      return false
    }

    return true
  }

  const sanitizeEmailValue = (value) =>
    value.replace(/\s/g, "").toLowerCase()

  // Save data to session storage whenever formData changes
  useEffect(() => {
    sessionStorage.setItem("deliverySignupDetails", JSON.stringify(formData))
  }, [formData])

  const handleChange = (e) => {
    const { name, value } = e.target
    let updatedValue = value

    if (name === "drivingLicenseNumber") {
      updatedValue = updatedValue.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16)
    }

    if (name === "panNumber") {
      updatedValue = updatedValue.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10)
    }

    // Restrict Aadhaar to numeric only and format as XXXX XXXX XXXX
    if (name === "aadharNumber") {
      const digits = value.replace(/\D/g, "").slice(0, 12)
      updatedValue = digits.replace(/(\d{4})(?=\d)/g, "$1 ")
    }

    if (name === "city" || name === "state") {
      updatedValue = sanitizeLocationValue(value)
    }

    if (name === "email") {
      updatedValue = sanitizeEmailValue(value)
    }

    setFormData(prev => ({
      ...prev,
      [name]: updatedValue
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (!isValidNameValue(formData.name)) {
      newErrors.name = "Name can contain letters only"
    }

    if (formData.email && !isValidEmailValue(formData.email)) {
      newErrors.email = "Enter a valid email address. Gmail must be gmail.com"
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required"
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required"
    } else if (!isValidLocationValue(formData.city)) {
      newErrors.city = "City can contain letters only"
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required"
    } else if (!isValidLocationValue(formData.state)) {
      newErrors.state = "State can contain letters only"
    }

    if (formData.vehicles.length === 0) {
      newErrors.vehicles = "Please add at least one vehicle"
    }

    const requiresDl = formData.vehicles.some(v => {
      const master = porterVehicles.find(p => p.id === v.vehicleId);
      const cat = master?.category?.toLowerCase() || "";
      return cat !== "bicycle" && cat !== "electric bike" && cat !== "electric_bike";
    });

    if (requiresDl) {
      if (!formData.drivingLicenseNumber.trim()) {
        newErrors.drivingLicenseNumber = "Driving license number is required"
      } else if (!/^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(formData.drivingLicenseNumber)) {
        newErrors.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)"
      }
    } else {
      if (formData.drivingLicenseNumber.trim()) {
        if (!/^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(formData.drivingLicenseNumber)) {
          newErrors.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)"
        }
      }
    }

    if (!formData.panNumber.trim()) {
      newErrors.panNumber = "PAN number is required"
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.replace(/\s/g, ""))) {
      newErrors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)"
    }

    const aadharClean = formData.aadharNumber.replace(/\s/g, "")
    if (!aadharClean) {
      newErrors.aadharNumber = "Aadhar number is required"
    } else if (!/^\d{12}$/.test(aadharClean)) {
      newErrors.aadharNumber = "Aadhar number must be 12 digits"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      toast.error("Please fill all required fields correctly")
      // Focus first error field
      setTimeout(() => {
         const firstError = Object.keys(errors)[0]
         if (firstError) document.querySelector(`[name="${firstError}"]`)?.focus()
      }, 100)
      return
    }

    setIsSubmitting(true)

    try {
      // Validate unique documents with backend
      await deliveryAPI.validateDocumentsPublic({
         drivingLicenseNumber: formData.drivingLicenseNumber,
         panNumber: formData.panNumber,
         aadharNumber: formData.aadharNumber
      })

      const details = {
        name: formData.name.trim(),
        phone: String(formData.phone || "").replace(/\D/g, "").slice(0, 15),
        countryCode: formData.countryCode || "+91",
        ref: String(formData.ref || "").trim() || "",
        email: formData.email?.trim() || "",
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        vehicles: formData.vehicles,
        drivingLicenseNumber: formData.drivingLicenseNumber.trim().toUpperCase(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.replace(/\s/g, "")
      }
      sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
      toast.success("Details saved")
      navigate("/food/delivery/signup/documents")
    } catch (error) {
      debugError("Error saving details:", error)
      if (error?.response?.status === 409) {
          const backendErrors = error.response.data?.errors || {}
          setErrors(prev => ({ ...prev, ...backendErrors }))
          toast.error(error.response.data?.message || "Duplicate documents found")
          setTimeout(() => {
              const firstError = Object.keys(backendErrors)[0]
              if (firstError) document.querySelector(`[name="${firstError}"]`)?.focus()
          }, 100)
      } else {
          toast.error("Failed to save. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const requiresDl = formData.vehicles.some(v => {
    const master = porterVehicles.find(p => p.id === v.vehicleId);
    const cat = master?.category?.toLowerCase() || "";
    return cat !== "bicycle" && cat !== "electric bike" && cat !== "electric_bike";
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Complete Your Profile</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Basic Details</h2>
          <p className="text-sm text-gray-600">Please provide your information to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              inputMode="text"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.name ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Enter your full name"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              inputMode="email"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.email ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Enter your email"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.address ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Enter your address"
            />
            {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.city ? "border-red-500" : "border-gray-300"
                  }`}
                placeholder="City"
              />
              {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.state ? "border-red-500" : "border-gray-300"
                  }`}
                placeholder="State"
              />
              {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
            </div>
          </div>

          {/* My Vehicles Section */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">My Vehicles</h3>
            </div>
            
            {formData.vehicles.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500">No vehicles added yet.</p>
                {errors.vehicles && <p className="text-red-500 text-sm mt-1">{errors.vehicles}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {formData.vehicles.map(v => {
                  const master = porterVehicles.find(p => p.id === v.vehicleId);
                  return (
                    <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveVehicle(v.id)}
                        className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center p-2 border border-gray-100 shrink-0">
                          {master?.image ? (
                            <img src={master.image} alt={master.name} className="w-full h-full object-contain" />
                          ) : (
                            <Truck className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-base truncate">{master?.name || "Unknown Vehicle"}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{master?.category || ""}</p>
                          
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500 text-xs block">Reg. Number</span>
                              <span className="font-medium text-gray-900">{v.registrationNumber || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs block">Status</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {v.status}
                              </span>
                            </div>
                          </div>
                          
                          {master?.supportedServices && master.supportedServices.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {master.supportedServices.map(service => (
                                <span key={service} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium capitalize">
                                  {service}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!showAddVehicle ? (
              <button
                type="button"
                onClick={() => setShowAddVehicle(true)}
                className="mt-4 w-full py-3 rounded-lg border-2 border-dashed border-green-500 text-green-600 font-medium hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
              >
                <span>+ Add Another Vehicle</span>
              </button>
            ) : (
              <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-900">Add New Vehicle</h4>
                  <button type="button" onClick={() => setShowAddVehicle(false)} className="text-gray-500 hover:text-gray-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Vehicle <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newVehicle.vehicleId}
                      onChange={(e) => setNewVehicle(p => ({ ...p, vehicleId: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Choose from list...</option>
                      {porterVehicles.filter(pv => !formData.vehicles.some(v => v.vehicleId === pv.id)).map(pv => (
                        <option key={pv.id} value={pv.id}>{pv.name} ({pv.category})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={newVehicle.registrationNumber}
                      onChange={(e) => setNewVehicle(p => ({ ...p, registrationNumber: e.target.value.toUpperCase().slice(0, 10) }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., MH12AB1234"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle Model (Optional)
                    </label>
                    <input
                      type="text"
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle(p => ({ ...p, model: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 2022 Edition"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleAddVehicle}
                    className="w-full py-3 rounded-lg font-bold text-white bg-gray-900 hover:bg-black transition-colors"
                  >
                    Confirm Vehicle
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Driving License Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driving License Number {requiresDl && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              name="drivingLicenseNumber"
              value={formData.drivingLicenseNumber}
              onChange={handleChange}
              maxLength={16}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 uppercase ${errors.drivingLicenseNumber ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="e.g., MH1220110012345"
            />
            {errors.drivingLicenseNumber && <p className="text-red-500 text-sm mt-1">{errors.drivingLicenseNumber}</p>}
          </div>

          {/* PAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PAN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              maxLength={10}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 uppercase ${errors.panNumber ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="ABCDE1234F"
            />
            {errors.panNumber && <p className="text-red-500 text-sm mt-1">{errors.panNumber}</p>}
          </div>

          {/* Aadhar Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aadhar Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="aadharNumber"
              value={formData.aadharNumber}
              onChange={handleChange}
              maxLength={14}
              inputMode="numeric"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.aadharNumber ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="1234 5678 9012"
            />
            {errors.aadharNumber && <p className="text-red-500 text-sm mt-1">{errors.aadharNumber}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  )
}


