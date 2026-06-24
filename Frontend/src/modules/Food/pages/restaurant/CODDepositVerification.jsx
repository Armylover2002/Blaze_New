import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { 
  ArrowLeft, 
  AlertCircle, 
  Upload, 
  Loader2, 
  Check, 
  X, 
  Eye, 
  User, 
  Phone, 
  Clock, 
  IndianRupee, 
  Image as ImageIcon,
  FileCheck,
  CheckCircle2,
  XCircle
} from "lucide-react"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

export default function CODDepositVerification() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const [requests, setRequests] = useState([])
  const [activeTab, setActiveTab] = useState("Pending") // "Pending", "Restaurant_Accepted", "Restaurant_Rejected"
  
  // Modals / Dialog states
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState(null)
  
  // Accept Form state
  const [acceptProof, setAcceptProof] = useState(null)
  const [acceptProofPreview, setAcceptProofPreview] = useState("")
  const [acceptNote, setAcceptNote] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  
  // Reject Form state
  const [rejectNote, setRejectNote] = useState("")
  
  const fileInputRef = useRef(null)

  const loadRequests = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getCODDeposits()
      const data = response?.data?.data?.requests || response?.data?.requests || []
      setRequests(data)
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load COD deposit requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (activeTab === "Pending") return r.status === "Pending"
      if (activeTab === "Restaurant_Accepted") return r.status === "Restaurant_Accepted" || r.status === "Completed"
      if (activeTab === "Restaurant_Rejected") return r.status === "Restaurant_Rejected" || r.status === "Failed"
      return true
    })
  }, [requests, activeTab])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size too large. Max 5MB allowed.")
      return
    }

    setAcceptProof(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setAcceptProofPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleOpenAccept = (req) => {
    setSelectedRequest(req)
    setAcceptProof(null)
    setAcceptProofPreview("")
    setAcceptNote("")
    setShowAcceptModal(true)
  }

  const handleOpenReject = (req) => {
    setSelectedRequest(req)
    setRejectNote("")
    setShowRejectModal(true)
  }

  const handleAcceptSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRequest) return

    try {
      setIsUploading(true)
      setProcessingId(selectedRequest.id)
      
      const formData = new FormData()
      formData.append("action", "accept")
      formData.append("restaurantNote", acceptNote.trim())
      if (acceptProof) {
        formData.append("restaurantProof", acceptProof)
      }

      const response = await restaurantAPI.processCODDeposit(selectedRequest.id, formData)
      if (response.data?.success) {
        toast.success("Cash deposit accepted successfully")
        setShowAcceptModal(false)
        await loadRequests()
      } else {
        toast.error(response.data?.message || "Failed to process request")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to accept deposit request")
    } finally {
      setIsUploading(false)
      setProcessingId(null)
    }
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRequest) return
    if (!rejectNote.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }

    try {
      setIsUploading(true)
      setProcessingId(selectedRequest.id)

      const formData = new FormData()
      formData.append("action", "reject")
      formData.append("restaurantNote", rejectNote.trim())

      const response = await restaurantAPI.processCODDeposit(selectedRequest.id, formData)
      if (response.data?.success) {
        toast.success("Deposit request rejected successfully")
        setShowRejectModal(false)
        await loadRequests()
      } else {
        toast.error(response.data?.message || "Failed to process request")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject deposit request")
    } finally {
      setIsUploading(false)
      setProcessingId(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A"
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return "N/A"
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Premium Header */}
      <div className="bg-white px-4 pt-4 pb-1 flex flex-col gap-3 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">COD Deposit Verification</h1>
            <p className="text-xs text-slate-500 font-medium">Verify physical cash handover from delivery partners</p>
          </div>
        </div>

        {/* Dynamic Segmented Control / Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-2">
          {["Pending", "Restaurant_Accepted", "Restaurant_Rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                activeTab === tab
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-550 hover:text-slate-800"
              }`}
            >
              {tab === "Pending" && "Pending Requests"}
              {tab === "Restaurant_Accepted" && "Accepted"}
              {tab === "Restaurant_Rejected" && "Rejected"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Request Listing */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm font-semibold">Fetching handover requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm max-w-md mx-auto mt-6">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
              <FileCheck className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-slate-800 font-extrabold text-lg">No Handovers Found</h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-medium">
              There are no {activeTab === "Pending" ? "pending" : activeTab === "Restaurant_Accepted" ? "accepted" : "rejected"} COD deposit requests matching this section.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-md mx-auto">
            {filteredRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                {/* Status indicator pill */}
                <div className="absolute right-4 top-4">
                  {req.status === "Pending" && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                      Pending
                    </span>
                  )}
                  {(req.status === "Restaurant_Accepted" || req.status === "Completed") && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                      {req.status === "Completed" ? "Settled" : "Accepted"}
                    </span>
                  )}
                  {(req.status === "Restaurant_Rejected" || req.status === "Failed") && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
                      {req.status === "Failed" ? "Rejected by Admin" : "Rejected"}
                    </span>
                  )}
                </div>

                {/* Amount and Time */}
                <div className="flex items-center gap-1 text-slate-900 mb-3">
                  <span className="text-2xl font-black">₹{req.amount.toLocaleString("en-IN")}</span>
                </div>

                {/* Delivery Boy Details */}
                <div className="space-y-2 border-t border-b border-slate-100 py-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Rider Details</p>
                      <p className="text-sm font-bold text-slate-800">{req.deliveryName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Rider Phone</p>
                      <p className="text-sm font-semibold text-slate-700">{req.deliveryPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Submitted At</p>
                      <p className="text-xs font-semibold text-slate-700">{formatDate(req.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Uploaded proofs and notes */}
                <div className="space-y-3">
                  {/* Rider proof preview */}
                  {req.paymentProof ? (
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5">Rider Proof Screenshot</p>
                      <div 
                        onClick={() => setFullscreenImage(req.paymentProof)}
                        className="relative w-full h-32 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer group"
                      >
                        <img src={req.paymentProof} alt="Rider Proof" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Rider Proof Screenshot</p>
                      <p className="text-xs text-slate-500 italic">No proof image uploaded by rider</p>
                    </div>
                  )}

                  {/* Restaurant proof preview (if processed) */}
                  {req.restaurantProof && (
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5">Your Uploaded Receipt Confirmation</p>
                      <div 
                        onClick={() => setFullscreenImage(req.restaurantProof)}
                        className="relative w-full h-32 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer group"
                      >
                        <img src={req.restaurantProof} alt="Restaurant Proof" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes / comments */}
                  {req.restaurantNote && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-xs">
                      <p className="font-bold text-slate-650 mb-0.5">Your Review Comment:</p>
                      <p className="text-slate-800 font-medium">{req.restaurantNote}</p>
                    </div>
                  )}
                </div>

                {/* Actions inside card for Pending status */}
                {req.status === "Pending" && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenReject(req)}
                      disabled={processingId === req.id}
                      className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleOpenAccept(req)}
                      disabled={processingId === req.id}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/10"
                    >
                      <Check className="w-4 h-4" />
                      <span>Accept</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACCEPT REQUEST DIALOG / SHEET */}
      {showAcceptModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/55 z-[999] flex items-end justify-center p-0 md:p-4 md:items-center" onClick={() => setShowAcceptModal(false)}>
          <div className="bg-white w-full rounded-t-2xl md:rounded-2xl max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-150 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900">Accept COD Handover</h2>
              <button onClick={() => setShowAcceptModal(false)} className="p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleAcceptSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Reviewing Cash Details</p>
                  <p className="text-sm font-black text-slate-800 mt-0.5">Rider: {selectedRequest.deliveryName}</p>
                  <p className="text-lg font-black text-blue-700 mt-1">Amount Due: ₹{selectedRequest.amount.toLocaleString("en-IN")}</p>
                </div>
              </div>

              {/* File upload preview container */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Upload Cash Receipt Image (Confirmation)</label>
                
                {acceptProofPreview ? (
                  <div className="relative rounded-xl border border-slate-200 overflow-hidden h-44 bg-slate-50 group">
                    <img src={acceptProofPreview} alt="Receipt Preview" className="w-full h-full object-contain" />
                    <button 
                      type="button"
                      onClick={() => { setAcceptProof(null); setAcceptProofPreview(""); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 rounded-full text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={triggerFileSelect}
                    className="border-2 border-dashed border-slate-300 rounded-2xl h-44 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:scale-105 transition-transform">
                      <Upload className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold text-blue-600 hover:text-blue-700">Click to upload proof</span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">JPEG, PNG up to 5MB</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                )}
              </div>

              {/* Note comment */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Add confirmation comment (Optional)</label>
                <textarea
                  value={acceptNote}
                  onChange={(e) => setAcceptNote(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all"
                  rows={3}
                  placeholder="e.g. Received full cash amount physically, confirmed and counted."
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/10"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Accept</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT REQUEST DIALOG / SHEET */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/55 z-[999] flex items-end justify-center p-0 md:p-4 md:items-center" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white w-full rounded-t-2xl md:rounded-2xl max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-150 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900">Reject COD Handover</h2>
              <button onClick={() => setShowRejectModal(false)} className="p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-3.5 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Rejecting Cash Handover</p>
                  <p className="text-sm font-black text-slate-800 mt-0.5">Rider: {selectedRequest.deliveryName}</p>
                  <p className="text-sm font-bold text-slate-700">Amount Due: ₹{selectedRequest.amount.toLocaleString("en-IN")}</p>
                </div>
              </div>

              {/* Note comment */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Rejection Reason (Required)</label>
                <textarea
                  value={rejectNote}
                  required
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm font-medium transition-all"
                  rows={4}
                  placeholder="Explain why you are rejecting this COD deposit request (e.g. Cash amount is incorrect, rider proof screenshot is invalid)."
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-red-600/10"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span>Confirm Reject</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE VIEWER MODAL */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col" onClick={() => setFullscreenImage(null)}>
          <div className="p-4 flex items-center justify-end">
            <button onClick={() => setFullscreenImage(null)} className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={fullscreenImage} alt="Fullscreen proof" className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  )
}
