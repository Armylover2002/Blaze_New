import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Clock, Users, Search, MessageSquare, CheckCircle2, Clock4, UploadCloud, ImagePlus, ChevronDown, ChevronUp, Sparkles, MapPin, Phone, Info, X, ArrowLeft } from "lucide-react"
import { diningAPI, restaurantAPI } from "@food/api"
import Loader from "@food/components/Loader"
import { Badge } from "@food/components/ui/badge"
import { toast } from "sonner"
const debugError = (...args) => {}

const getRestaurantFromResponse = (response) =>
    response?.data?.data?.restaurant ||
    response?.data?.restaurant ||
    response?.data?.data ||
    null

const normalizeImageEntry = (entry) => {
    if (!entry) return null
    if (typeof entry === "string") {
        const url = entry.trim()
        return url ? { url, publicId: null } : null
    }
    const url = String(entry?.url || "").trim()
    if (!url) return null
    return {
        url,
        publicId: entry?.publicId || null,
    }
}

const getProfilePhotoUrl = (restaurant) => {
    const candidate = restaurant?.profileImage
    if (!candidate) return ""
    if (typeof candidate === "string") return candidate.trim()
    return String(candidate?.url || "").trim()
}

const getCoverImages = (restaurant) => {
    const base = Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : []
    return base
        .map(normalizeImageEntry)
        .filter(Boolean)
}

const getMenuImages = (restaurant) => {
    const base = Array.isArray(restaurant?.menuImages) ? restaurant.menuImages : []

    return base
        .map(normalizeImageEntry)
        .filter(Boolean)
}

const getBookerName = (booking) =>
    String(
        booking?.user?.name ||
        booking?.customerName ||
        booking?.bookedBy?.name ||
        booking?.name ||
        "Guest"
    ).trim()

const getBookerPhone = (booking) =>
    String(
        booking?.user?.phone ||
        booking?.phone ||
        booking?.phoneNumber ||
        booking?.mobile ||
        booking?.bookedBy?.phone ||
        ""
    ).trim()


export default function DiningReservations() {
    const navigate = useNavigate()
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [restaurant, setRestaurant] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [restaurantPhoto, setRestaurantPhoto] = useState("")
    const [restaurantPhotos, setRestaurantPhotos] = useState([])
    const [menuPhotos, setMenuPhotos] = useState([])
    const [uploadingRestaurantPhoto, setUploadingRestaurantPhoto] = useState(false)
    const [uploadingMenuPhotos, setUploadingMenuPhotos] = useState(false)
    const [removingRestaurantPhoto, setRemovingRestaurantPhoto] = useState(false)
    const [removingMenuPhoto, setRemovingMenuPhoto] = useState(false)
    const [uploadMessage, setUploadMessage] = useState("")
    const [uploadError, setUploadError] = useState("")
    const [activeSection, setActiveSection] = useState("reservations")
    const [activeView, setActiveView] = useState("priority")
    const [showMediaPanel, setShowMediaPanel] = useState(false)
    const [diningEnabled, setDiningEnabled] = useState(false)
    const [maxGuestsLimit, setMaxGuestsLimit] = useState(6)
    const [savingDiningSettings, setSavingDiningSettings] = useState(false)
    const [diningSettingsMessage, setDiningSettingsMessage] = useState("")
    const [diningSettingsError, setDiningSettingsError] = useState("")
    const [diningCategories, setDiningCategories] = useState([])
    const [selectedDiningCategoryIds, setSelectedDiningCategoryIds] = useState([])

    const activeDiningRequest = restaurant?.pendingDiningRequest || null
    const isDiningToggleOn = Boolean(diningEnabled)

    const syncRestaurantMediaState = (restaurantData) => {
        setRestaurant(restaurantData || null)
        const coverImages = getCoverImages(restaurantData)
        const profileImage = getProfilePhotoUrl(restaurantData)
        setRestaurantPhotos(coverImages)
        setRestaurantPhoto(coverImages[0]?.url || profileImage)
        setMenuPhotos(getMenuImages(restaurantData))
        const draftDiningState = restaurantData?.pendingDiningRequest || restaurantData?.diningSettings || {}
        setDiningEnabled(Boolean(draftDiningState?.isEnabled))
        setMaxGuestsLimit(
            draftDiningState?.isEnabled
                ? Math.max(1, parseInt(draftDiningState?.maxGuests, 10) || 6)
                : 0
        )
        setSelectedDiningCategoryIds(
            draftDiningState?.isEnabled && Array.isArray(draftDiningState?.categoryIds) && draftDiningState.categoryIds.length > 0
                ? draftDiningState.categoryIds.map((id) => String(id))
                : (Array.isArray(restaurantData?.diningCategoryIds) && restaurantData?.diningSettings?.isEnabled !== false)
                    ? restaurantData.diningCategoryIds.map((id) => String(id))
                    : []
        )
    }

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // First get the current restaurant
                const [resResponse, categoriesResponse] = await Promise.all([
                    restaurantAPI.getCurrentRestaurant(),
                    diningAPI.getCategories().catch(() => null),
                ])

                if (categoriesResponse?.data?.success) {
                    setDiningCategories(Array.isArray(categoriesResponse.data.data) ? categoriesResponse.data.data : [])
                }

                if (resResponse.data.success) {
                    const resData = getRestaurantFromResponse(resResponse)

                    const restaurantId = resData?._id || resData?.id

                    if (restaurantId) {
                        syncRestaurantMediaState(resData)
                        // Then get its bookings
                        const bookingsResponse = await diningAPI.getRestaurantBookings(resData)
                        if (bookingsResponse.data.success) {
                            setBookings(Array.isArray(bookingsResponse.data.data) ? bookingsResponse.data.data : [])
                        }
                    } else {
                        debugError("Restaurant ID not found in response:", resData)
                    }
                }
            } catch (error) {
                debugError("Error fetching reservations:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchAll()
    }, [])

    const handleRestaurantPhotoUpload = async (event) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        setUploadError("")
        setUploadMessage("")
        setUploadingRestaurantPhoto(true)

        try {
            await restaurantAPI.uploadCoverImages(files)
            const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
            const refreshedRestaurant = getRestaurantFromResponse(refreshedResponse)
            syncRestaurantMediaState(refreshedRestaurant)
            setUploadMessage(`Uploaded ${files.length} restaurant photo(s) successfully.`)
        } catch (error) {
            debugError("Error uploading restaurant photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to upload restaurant photos.")
        } finally {
            setUploadingRestaurantPhoto(false)
            event.target.value = ""
        }
    }

    const handleMenuPhotosUpload = async (event) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        setUploadError("")
        setUploadMessage("")
        setUploadingMenuPhotos(true)

        try {
            await restaurantAPI.uploadMenuImages(files)
            const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
            syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            setUploadMessage(`Uploaded ${files.length} menu photo(s) successfully.`)
        } catch (error) {
            debugError("Error saving menu photos:", error)
            setUploadError(error?.response?.data?.message || "Failed to upload menu photos.")
        } finally {
            setUploadingMenuPhotos(false)
            event.target.value = ""
        }
    }

    const handleRemoveRestaurantPhoto = async (photoUrl) => {
        if (!photoUrl || removingRestaurantPhoto) return

        setUploadError("")
        setUploadMessage("")
        setRemovingRestaurantPhoto(true)

        try {
            const nextCoverImages = restaurantPhotos.filter((photo) => photo.url !== photoUrl)
            const currentProfileImage = getProfilePhotoUrl(restaurant)
            const nextPrimaryPhoto = nextCoverImages[0]?.url || ""
            const shouldClearProfileImage = !nextPrimaryPhoto && currentProfileImage === photoUrl

            const response = await restaurantAPI.updateProfile({
                coverImages: nextCoverImages.map((photo) => ({
                    url: photo.url,
                    ...(photo.publicId ? { publicId: photo.publicId } : {}),
                })),
                ...(shouldClearProfileImage ? { profileImage: "" } : {}),
            })

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            } else {
                const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
                syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            }

            setUploadMessage("Restaurant photo removed successfully.")
        } catch (error) {
            debugError("Error removing restaurant photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to remove restaurant photo.")
        } finally {
            setRemovingRestaurantPhoto(false)
        }
    }

    const handleRemoveMenuPhoto = async (photoUrl) => {
        if (!photoUrl || removingMenuPhoto) return

        setUploadError("")
        setUploadMessage("")
        setRemovingMenuPhoto(true)

        try {
            const nextMenuPhotos = menuPhotos.filter((photo) => photo.url !== photoUrl)
            const response = await restaurantAPI.updateProfile({
                menuImages: nextMenuPhotos.map((photo) => ({
                    url: photo.url,
                    ...(photo.publicId ? { publicId: photo.publicId } : {}),
                })),
            })

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            } else {
                const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
                syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            }

            setUploadMessage("Menu photo removed successfully.")
        } catch (error) {
            debugError("Error removing menu photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to remove menu photo.")
        } finally {
            setRemovingMenuPhoto(false)
        }
    }

    const handleSaveDiningSettings = async () => {
        if (!restaurant || savingDiningSettings) return
        if (isDiningToggleOn && selectedDiningCategoryIds.length === 0) {
            setDiningSettingsError("Select at least one dining category.")
            return
        }

        const nextMaxGuests = isDiningToggleOn ? Math.max(1, parseInt(maxGuestsLimit, 10) || 1) : 0
        const nextDiningSettings = {
            isEnabled: isDiningToggleOn,
            maxGuests: nextMaxGuests,
            categoryIds: isDiningToggleOn ? selectedDiningCategoryIds : [],
            primaryCategoryId: isDiningToggleOn ? selectedDiningCategoryIds[0] : null,
        }

        setDiningSettingsError("")
        setDiningSettingsMessage("")
        setSavingDiningSettings(true)

        try {
            const response = await restaurantAPI.updateDiningSettings(nextDiningSettings)

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            }

            setDiningSettingsMessage("Dining request sent to admin. Changes will apply after approval.")
            toast.success("Dining request sent for approval")
        } catch (error) {
            debugError("Error saving dining settings:", error)
            setDiningSettingsError(error?.response?.data?.message || "Failed to submit dining request.")
            toast.error(error?.response?.data?.message || "Failed to submit dining request")
        } finally {
            setSavingDiningSettings(false)
        }
    }

    const toggleDiningCategory = (categoryId) => {
        if (!isDiningToggleOn) return
        const nextCategoryId = String(categoryId || "").trim()
        if (!nextCategoryId) return

        setSelectedDiningCategoryIds((prev) =>
            prev.includes(nextCategoryId)
                ? prev.filter((id) => id !== nextCategoryId)
                : [...prev, nextCategoryId]
        )
    }

    const handleStatusUpdate = async (bookingId, newStatus) => {
        try {
            const response = await diningAPI.updateBookingStatusRestaurant(bookingId, newStatus)
            if (response.data.success) {
                // Update local state
                setBookings(prev => prev.map(b =>
                    b._id === bookingId ? { ...b, status: newStatus } : b
                ))
            }
        } catch (error) {
            debugError("Error updating status:", error)
        }
    }

    const getStatusPriority = (status) => {
        const key = String(status || "").toLowerCase()
        if (key === "confirmed") return 0
        if (key === "accepted") return 1
        if (key === "checked-in") return 2
        if (key === "completed") return 3
        if (key === "cancelled") return 4
        return 5
    }

    const getBookingTimestamp = (booking) => {
        const createdAtTs = new Date(booking?.createdAt || "").getTime()
        if (!Number.isNaN(createdAtTs)) return createdAtTs
        const dateTs = new Date(booking?.date || "").getTime()
        if (!Number.isNaN(dateTs)) return dateTs
        return 0
    }

    const isToday = (value) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return false
        return date.toDateString() === new Date().toDateString()
    }

    const isNewRequest = (booking) => {
        if (String(booking?.status || "").toLowerCase() !== "confirmed") return false
        const createdAt = new Date(booking?.createdAt || booking?.date || "").getTime()
        if (Number.isNaN(createdAt)) return true
        return Date.now() - createdAt <= 2 * 60 * 60 * 1000
    }

    const sortedBookings = useMemo(() => {
        return [...bookings].sort((a, b) => {
            const priorityDiff = getStatusPriority(a?.status) - getStatusPriority(b?.status)
            if (priorityDiff !== 0) return priorityDiff
            return getBookingTimestamp(b) - getBookingTimestamp(a)
        })
    }, [bookings])

    const filteredBookings = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        return sortedBookings
            .filter((booking) => {
                if (!term) return true
                return (
                    getBookerName(booking).toLowerCase().includes(term) ||
                    String(booking?.bookingId || "").toLowerCase().includes(term) ||
                    getBookerPhone(booking).toLowerCase().includes(term)
                )
            })
            .filter((booking) => {
                if (activeView === "today") return isToday(booking?.date)
                if (activeView === "new") return isNewRequest(booking)
                return true
            })
    }, [sortedBookings, searchTerm, activeView])

    const newRequestsCount = useMemo(
        () => bookings.filter((booking) => isNewRequest(booking)).length,
        [bookings]
    )

    if (loading) return <Loader />

    return (
        <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
            {/* Header - Always Fixed/Sticky */}
            <div className="shrink-0 bg-white border-b border-gray-100 z-30">
                <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-3">
                            Table Reservations
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Queue Management</span>
                        </h1>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search guests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-slate-50 border border-transparent rounded-full text-sm font-medium focus:bg-white focus:border-gray-200 outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-center bg-slate-50 p-1 rounded-full border border-gray-100">
                            <button
                                onClick={() => setActiveSection("reservations")}
                                className={`px-5 py-1.5 text-xs font-bold rounded-full transition-all ${activeSection === "reservations" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                QUEUE
                            </button>
                            <button
                                onClick={() => setActiveSection("media")}
                                className={`px-5 py-1.5 text-xs font-bold rounded-full transition-all ${activeSection === "media" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                MEDIA
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-[1400px] mx-auto p-6 space-y-6 pb-20">
                    {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/30 rounded-bl-full -mr-10 -mt-10" />
                        <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-sm z-10">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="z-10">
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Total Bookings</p>
                            <p className="text-2xl font-black text-slate-900 leading-none mt-1">{bookings.length}</p>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-bl-full -mr-10 -mt-10" />
                        <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-sm z-10">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="z-10">
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Active</p>
                            <p className="text-2xl font-black text-slate-900 leading-none mt-1">
                                {bookings.filter(b => ['confirmed', 'accepted', 'checked-in'].includes(String(b.status || '').toLowerCase())).length}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-bl-full -mr-10 -mt-10" />
                        <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-sm z-10">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div className="z-10">
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Today's Bookings</p>
                            <p className="text-2xl font-black text-slate-900 leading-none mt-1">
                                {bookings.filter(b => new Date(b.date).toDateString() === new Date().toDateString()).length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mb-6 md:hidden">
                    <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-1">
                        <button
                            onClick={() => setActiveSection("reservations")}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${activeSection === "reservations" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                        >
                            Reservations
                        </button>
                        <button
                            onClick={() => setActiveSection("media")}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${activeSection === "media" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                        >
                            Photos & Menu
                        </button>
                    </div>
                </div>

                {activeSection === "media" && (
                <div className="mb-8">
                    <button
                        onClick={() => setShowMediaPanel((prev) => !prev)}
                        className="w-full bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                        <div>
                            <h2 className="text-left text-base font-bold text-slate-900">Photos & Menu Manager</h2>
                            <p className="text-left text-sm text-slate-500">Upload restaurant and menu images only when needed.</p>
                        </div>
                        {showMediaPanel ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </button>
                </div>
                )}

                {activeSection === "media" && showMediaPanel && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Restaurant Photos</h2>
                                <p className="text-sm text-slate-500 mt-1">Add multiple restaurant photos. The first one will be used as the main preview.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer hover:bg-slate-800 transition-colors">
                                <UploadCloud className="w-4 h-4" />
                                {uploadingRestaurantPhoto ? "Uploading..." : "Add Photos"}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleRestaurantPhotoUpload}
                                    disabled={uploadingRestaurantPhoto || removingRestaurantPhoto}
                                />
                            </label>
                        </div>

                        <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-56">
                            {restaurantPhoto ? (
                                <img
                                    src={restaurantPhoto}
                                    alt={restaurant?.restaurantName || restaurant?.name || "Restaurant"}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                    <ImagePlus className="w-8 h-8 mb-2" />
                                    <p className="text-sm font-medium">No restaurant photo added yet</p>
                                </div>
                            )}
                        </div>

                        {restaurantPhotos.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {restaurantPhotos.map((photo, index) => (
                                    <button
                                        key={`${photo.url}-${index}`}
                                        type="button"
                                        onClick={() => setRestaurantPhoto(photo.url)}
                                        className={`relative h-20 rounded-lg overflow-hidden border bg-slate-50 transition-all ${restaurantPhoto === photo.url ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200"}`}
                                    >
                                        <img
                                            src={photo.url}
                                            alt={`Restaurant photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[10px] font-semibold text-white">
                                            {restaurantPhoto === photo.url ? "Main" : `Photo ${index + 1}`}
                                        </span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveRestaurantPhoto(photo.url)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleRemoveRestaurantPhoto(photo.url)
                                                }
                                            }}
                                            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Menu Photos</h2>
                                <p className="text-sm text-slate-500 mt-1">Add menu photos and view previously uploaded photos.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold cursor-pointer hover:bg-blue-700 transition-colors">
                                <UploadCloud className="w-4 h-4" />
                                {uploadingMenuPhotos ? "Uploading..." : "Add Photos"}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleMenuPhotosUpload}
                                    disabled={uploadingMenuPhotos || removingMenuPhoto}
                                />
                            </label>
                        </div>

                        {menuPhotos.length > 0 ? (
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {menuPhotos.map((photo, index) => (
                                    <div key={`${photo.url}-${index}`} className="relative h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                        <img src={photo.url} alt={`Menu photo ${index + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveMenuPhoto(photo.url)}
                                            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm"
                                            disabled={removingMenuPhoto}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-4 h-28 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                                <ImagePlus className="w-7 h-7 mb-2" />
                                <p className="text-sm font-medium">No menu photos added yet</p>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {activeSection === "reservations" && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Dining Controls</p>
                        <h2 className="text-lg font-bold text-slate-900">Manage dining availability and booking limit</h2>
                        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                            These settings update the same dining profile the guest booking flow reads, so restaurant changes are reflected on the user side too.
                        </p>

                        <div className="flex items-center gap-4 mt-6 border-b border-gray-100 pb-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2">
                                <span className={`h-2 w-2 rounded-full ${diningEnabled ? "bg-emerald-500" : "bg-rose-500"}`} />
                                <span className="text-sm font-semibold text-slate-700">
                                    {diningEnabled ? "Dining active" : "Dining paused"}
                                </span>
                            </div>

                            <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2">
                                <span className="text-sm font-medium text-slate-700">Turn dining on/off</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDiningEnabled((prev) => {
                                            const nextValue = !prev;
                                            if (!nextValue) {
                                                setSelectedDiningCategoryIds([]);
                                                setMaxGuestsLimit(0);
                                            } else {
                                                setMaxGuestsLimit((current) => Math.max(1, parseInt(current, 10) || 6));
                                            }
                                            return nextValue;
                                        });
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${diningEnabled ? "bg-slate-800" : "bg-slate-300"}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${diningEnabled ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 pb-6 border-b border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-bold text-slate-900">Choose Dining Categories (Pick Multiple)</span>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {diningCategories.length === 0 ? (
                                    <div className="text-sm text-slate-500 italic">No categories configured for this restaurant.</div>
                                ) : (
                                    diningCategories.map((category) => (
                                        <button
                                            key={category?._id}
                                            onClick={() => toggleDiningCategory(category?._id)}
                                            className={`w-36 p-3 rounded-2xl border flex flex-col items-center transition-all ${selectedDiningCategoryIds.includes(category?._id) ? "border-slate-800 ring-1 ring-slate-800 bg-slate-50/50" : "border-gray-200 hover:border-gray-300"}`}
                                        >
                                            <img src={category.imageUrl} className="w-full aspect-square object-cover rounded-xl mb-3" />
                                            <span className="text-xs font-bold text-slate-800">{category.name}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Maximum Guest Limit</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Guests allowed per reservation</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="flex items-center bg-slate-50 border border-gray-200 rounded-full p-1">
                                    <button onClick={() => setMaxGuestsLimit(Math.max(1, maxGuestsLimit - 1))} className="w-8 h-8 flex items-center justify-center text-slate-600 font-bold rounded-full hover:bg-slate-200">-</button>
                                    <span className="w-10 text-center text-sm font-bold text-slate-900">{maxGuestsLimit}</span>
                                    <button onClick={() => setMaxGuestsLimit(maxGuestsLimit + 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 font-bold rounded-full hover:bg-slate-200">+</button>
                                </div>
                                <button
                                    onClick={handleSaveDiningSettings}
                                    disabled={savingDiningSettings}
                                    className="px-6 py-2.5 bg-[#0F172A] text-white text-sm font-bold rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {savingDiningSettings ? "SAVING..." : "SAVE SETTINGS"}
                                </button>
                            </div>
                        </div>

                        {activeDiningRequest?.requestedAt && (
                            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                Pending request: {activeDiningRequest?.isEnabled ? "Dining On" : "Dining Off"}, guest limit {Number(activeDiningRequest?.maxGuests ?? 0)}
                                {Array.isArray(activeDiningRequest?.categories) && activeDiningRequest.categories.length > 0
                                    ? `, categories ${activeDiningRequest.categories.map((category) => category?.name).filter(Boolean).join(", ")}`
                                    : ""}
                            </div>
                        )}

                        {(diningSettingsMessage || diningSettingsError) && (
                            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${diningSettingsError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                                {diningSettingsError || diningSettingsMessage}
                            </div>
                        )}
                    </div>
                )}

                {(uploadMessage || uploadError) && (
                    <div className={`mb-6 rounded-xl px-4 py-3 text-sm font-medium border ${uploadError
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-green-50 text-green-700 border-green-200"
                        }`}>
                        {uploadError || uploadMessage}
                    </div>
                )}

                {/* Bookings List */}
                {activeSection === "reservations" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-900">Reservation Queue</h2>
                        <div className="flex items-center rounded-full border border-gray-200 bg-white p-0.5 overflow-hidden shadow-sm">
                            <button
                                onClick={() => setActiveView("priority")}
                                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${activeView === "priority" ? "bg-[#0F172A] text-white" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                Priority
                            </button>
                            <button
                                onClick={() => setActiveView("new")}
                                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${activeView === "new" ? "bg-[#0F172A] text-white" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                New ({newRequestsCount})
                            </button>
                            <button
                                onClick={() => setActiveView("today")}
                                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${activeView === "today" ? "bg-[#0F172A] text-white" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                Today
                            </button>
                        </div>
                    </div>

                    {newRequestsCount > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            {newRequestsCount} new reservation request{newRequestsCount > 1 ? "s" : ""} waiting for quick action.
                        </div>
                    )}

                    {filteredBookings.length > 0 ? (
                        <>
                            {/* Desktop View Table */}
                            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">ID</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest Details</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Schedule</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Guests</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <AnimatePresence mode="popLayout">
                                            {filteredBookings.map((booking) => (
                                                <motion.tr 
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    key={booking._id} 
                                                    className={`hover:bg-slate-50/50 transition-colors ${isNewRequest(booking) ? "bg-amber-50/20" : ""}`}
                                                >
                                                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400 text-center">#{booking.bookingId}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                                {getBookerName(booking).charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 leading-tight">{getBookerName(booking)}</p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                                    <p className="text-xs text-slate-500">{getBookerPhone(booking) || 'No phone'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                                <Calendar className="w-4 h-4 text-blue-500" />
                                                                {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                                <Clock className="w-4 h-4 text-blue-500" />
                                                                {booking.timeSlot}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="inline-flex items-center justify-center gap-1.5 font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-xs">
                                                            <Users className="w-3 h-3" />
                                                            {booking.guests}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                                String(booking.status || "").toLowerCase() === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                                                                String(booking.status || "").toLowerCase() === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                                String(booking.status || "").toLowerCase() === 'checked-in' ? 'bg-red-100 text-red-700' :
                                                                String(booking.status || "").toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-rose-100 text-rose-700'
                                                            }`}>
                                                                {booking.status}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'accepted')}
                                                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                                                >
                                                                    Accept
                                                                </button>
                                                            )}
                                                            {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'cancelled')}
                                                                    className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-50 transition-colors"
                                                                >
                                                                    Decline
                                                                </button>
                                                            )}
                                                            {String(booking.status || "").toLowerCase() === 'accepted' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'checked-in')}
                                                                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                                                                >
                                                                    Check-in
                                                                </button>
                                                            )}
                                                            {String(booking.status || "").toLowerCase() === 'checked-in' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'completed')}
                                                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                                                >
                                                                    Check-out
                                                                </button>
                                                            )}
                                                            {booking.specialRequest && (
                                                                <button
                                                                    title={booking.specialRequest}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 bg-blue-50/50"
                                                                >
                                                                    <MessageSquare className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View Cards */}
                            <div className="md:hidden space-y-4">
                                <AnimatePresence mode="popLayout">
                                    {filteredBookings.map((booking) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            key={booking._id}
                                            className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 ${isNewRequest(booking) ? "ring-2 ring-amber-400 ring-inset" : ""}`}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-sm uppercase">
                                                        {getBookerName(booking).charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 leading-none">{getBookerName(booking)}</h3>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">#{booking.bookingId}</p>
                                                    </div>
                                                </div>
                                                <Badge className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                    String(booking.status || "").toLowerCase() === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                                                    String(booking.status || "").toLowerCase() === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                    String(booking.status || "").toLowerCase() === 'checked-in' ? 'bg-red-100 text-red-700' :
                                                    String(booking.status || "").toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {booking.status}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-blue-500" />
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-blue-500" />
                                                    <span className="text-xs font-bold text-slate-700">{booking.timeSlot}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-blue-500" />
                                                    <span className="text-xs font-bold text-slate-700">{booking.guests} Guests</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-blue-500" />
                                                    <span className="text-xs font-bold text-slate-700 truncate">{getBookerPhone(booking) || 'No phone'}</span>
                                                </div>
                                            </div>

                                            {booking.specialRequest && (
                                                <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 rounded-xl mb-4 text-xs font-medium border border-blue-100">
                                                    <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                                                    <p>{booking.specialRequest}</p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'accepted')}
                                                        className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-colors uppercase tracking-widest"
                                                    >
                                                        Accept
                                                    </button>
                                                )}
                                                {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'cancelled')}
                                                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest"
                                                    >
                                                        Decline
                                                    </button>
                                                )}
                                                {String(booking.status || "").toLowerCase() === 'accepted' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'checked-in')}
                                                        className="flex-1 py-2.5 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-colors uppercase tracking-widest"
                                                    >
                                                        Check-in
                                                    </button>
                                                )}
                                                {String(booking.status || "").toLowerCase() === 'checked-in' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'completed')}
                                                        className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-colors uppercase tracking-widest"
                                                    >
                                                        Check-out
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white border border-gray-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center shadow-sm"
                        >
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                <Calendar className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No reservations found</h3>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                When guests book a table, they will appear here in your live queue.
                            </p>
                        </motion.div>
                    )}
                </div>
                )}
            </div>
        </div>
        </div>
    )
}
