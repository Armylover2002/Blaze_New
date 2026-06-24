import { useState, useEffect } from "react"
import { 
  Search, 
  Receipt, 
  Loader2, 
  Package, 
  Check, 
  X, 
  Eye, 
  Image as ImageIcon, 
  Calendar, 
  User, 
  IndianRupee, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock
} from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const formatCurrency = (amount) => {
  if (amount == null) return "₹0.00"
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (d) => {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })
  } catch {
    return String(d)
  }
}

export default function CashPayRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("Pending") // "Pending", "Completed", "Failed", or "All"
  const [methodFilter, setMethodFilter] = useState("All") // "All", "admin_bank", "admin_upi", "admin_qr"
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const limit = 20

  // Details Dialog / Modal State
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [adminNote, setAdminNote] = useState("")
  const [submittingAction, setSubmittingAction] = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null)

  const fetchData = async (overrides = {}) => {
    const p = overrides.page || page
    const status = overrides.status !== undefined ? overrides.status : statusFilter
    try {
      setLoading(true)
      const queryParams = {
        page: p,
        limit,
        status: status === "All" ? undefined : status,
      }
      if (searchQuery.trim()) {
        queryParams.search = searchQuery.trim()
      }
      
      const res = await adminAPI.getCashPayRequests(queryParams)
      if (res?.data?.success) {
        const data = res.data.data
        setRequests(data?.requests || [])
        setTotal(data?.pagination?.total || 0)
        setPages(data?.pagination?.pages || 1)
      } else {
        toast.error(res?.data?.message || "Failed to fetch cash pay requests")
        setRequests([])
      }
    } catch (err) {
      console.error("Error fetching cash pay requests:", err)
      toast.error(err?.response?.data?.message || "Failed to fetch cash pay requests")
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, statusFilter])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchData({ page: 1 })
    }, 500)
    return () => clearTimeout(t)
  }, [searchQuery])

  const handleOpenDetails = (req) => {
    setSelectedRequest(req)
    setAdminNote(req.adminNote || "")
    setShowDetails(true)
  }

  const handleCloseDetails = () => {
    if (!submittingAction) {
      setShowDetails(false)
      setSelectedRequest(null)
      setAdminNote("")
    }
  }

  const handleProcessRequest = async (status) => {
    if (!selectedRequest) return
    
    try {
      setSubmittingAction(true)
      const res = await adminAPI.updateCashPayRequestStatus(selectedRequest.id, {
        status,
        adminNote: adminNote.trim() || undefined
      })

      if (res?.data?.success) {
        toast.success(`Request ${status === "Completed" ? "approved" : "rejected"} successfully`)
        setShowDetails(false)
        setSelectedRequest(null)
        setAdminNote("")
        fetchData() // Refresh list
      } else {
        toast.error(res?.data?.message || "Failed to update request status")
      }
    } catch (err) {
      console.error(`Error ${status === "Completed" ? "approving" : "rejecting"} request:`, err)
      toast.error(err?.response?.data?.message || `Failed to update request status`)
    } finally {
      setSubmittingAction(false)
    }
  }

  const getMethodLabel = (type) => {
    switch (type) {
      case "admin_bank":
        return "Bank Details"
      case "admin_upi":
        return "UPI ID"
      case "admin_qr":
        return "QR Payment"
      case "zone_hub":
        return "Zone Hub"
      default:
        return type || "Unknown"
    }
  }

  const getMethodBadgeColor = (type) => {
    switch (type) {
      case "admin_bank":
        return "bg-blue-50 text-blue-700 border-blue-100"
      case "admin_upi":
        return "bg-purple-50 text-purple-700 border-purple-100"
      case "admin_qr":
        return "bg-amber-50 text-amber-700 border-amber-100"
      case "zone_hub":
        return "bg-indigo-50 text-indigo-700 border-indigo-100"
      default:
        return "bg-slate-50 text-slate-700 border-slate-100"
    }
  }

  // Filter requests locally by payment method if needed, on top of status/search API filtering
  const filteredRequests = requests.filter(r => {
    if (methodFilter === "All") return true
    return r.depositType === methodFilter
  })

  return (
    <div className="p-4 lg:p-6 bg-[#FAF9F6] min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Sleek Glassmorphism Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 mb-6 transition-all duration-300 hover:shadow-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-50 rounded-xl">
                  <Receipt className="w-6 h-6 text-red-600 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cash Pay Requests</h1>
                  <p className="text-sm text-slate-500 mt-0.5 font-medium">
                    Audit and settle manual cash limit deposit requests submitted by delivery boys.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Quick Status Stats Card */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 self-start md:self-auto">
              <div className="text-center px-4 py-1 border-r border-slate-200">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Requests</p>
                <p className="text-lg font-bold text-slate-800">{total}</p>
              </div>
              <div className="text-center px-4 py-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status Filtering</p>
                <span className={`text-xs font-bold ${statusFilter === "Pending" ? "text-amber-600" : statusFilter === "Completed" ? "text-emerald-600" : "text-slate-600"}`}>
                  {statusFilter}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 overflow-hidden">
          
          {/* Controls Bar: Tabs, Method Select, Search */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
            
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100/80 p-1.5 rounded-xl self-start">
              {["Pending", "Completed", "Failed", "All"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab)
                    setPage(1)
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                    statusFilter === tab
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
                  }`}
                >
                  {tab === "Pending" && "Awaiting Audit"}
                  {tab === "Completed" && "Approved"}
                  {tab === "Failed" && "Rejected"}
                  {tab === "All" && "Show All"}
                </button>
              ))}
            </div>

            {/* Sub-Filters: Payment Method & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              
              {/* Payment Method Select Dropdown */}
              <div className="relative">
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2.5 w-full sm:w-44 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer text-slate-700"
                >
                  <option value="All">All Methods</option>
                  <option value="admin_bank">Bank Details</option>
                  <option value="admin_upi">UPI ID</option>
                  <option value="admin_qr">QR Payment</option>
                  <option value="zone_hub">Zone Hub</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-initial sm:min-w-[280px]">
                <input
                  type="text"
                  placeholder="Search by Razorpay ID, details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Table / Grid Container */}
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-red-600 mx-auto mb-4" />
              <p className="text-slate-500 text-sm font-semibold animate-pulse">Loading cash pay requests...</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Delivery Boy</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proof</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="p-4 bg-slate-50 rounded-full mb-4">
                            <Package className="w-12 h-12 text-slate-300" />
                          </div>
                          <p className="text-base font-bold text-slate-800">No Requests Found</p>
                          <p className="text-xs text-slate-400 mt-1">
                            No manual deposit settlement requests matching these filter criteria exist.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req, i) => (
                      <tr key={req.id || i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400">
                          {(page - 1) * limit + i + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-semibold">
                          {formatDate(req.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{req.deliveryName}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{req.deliveryPartnerIdString}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getMethodBadgeColor(req.depositType)}`}>
                            {getMethodLabel(req.depositType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-extrabold text-slate-900">
                          {formatCurrency(req.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            req.status === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : req.status === "Failed"
                                ? "bg-rose-50 text-rose-700 border border-rose-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}>
                            {req.status === "Completed" && <Check className="w-3 h-3" />}
                            {req.status === "Failed" && <X className="w-3 h-3" />}
                            {req.status === "Pending" && <Clock className="w-3 h-3 animate-spin" />}
                            {req.status === "Pending" ? "Awaiting Audit" : req.status === "Completed" ? "Approved" : "Rejected"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {req.paymentProof ? (
                            <button
                              type="button"
                              onClick={() => setLightboxImage(req.paymentProof)}
                              className="inline-flex items-center justify-center p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 transition-colors"
                              title="View Payment Proof Screenshot"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(req)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 text-xs font-bold rounded-lg border border-red-100 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Audit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-semibold">
                Showing page <span className="text-slate-800">{page}</span> of <span className="text-slate-800">{pages}</span> · <span className="text-slate-800">{total}</span> total requests
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Detail Modal / Drawer */}
      {showDetails && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900">Request Audit & Settlement</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseDetails}
                disabled={submittingAction}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Top Banner - Outstanding Action Warning */}
              {selectedRequest.status === "Pending" && (
                <div className="flex gap-3 bg-amber-50 border border-amber-200/60 p-4 rounded-2xl">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-800">Pending Admin Audit</h4>
                    <p className="text-[11px] text-amber-600 font-semibold mt-0.5 leading-relaxed">
                      Please double-check the uploaded screenshot proof against your bank/wallet statement before approving. 
                      Approving will instantly credit this amount and restore the delivery boy's available cash limit.
                    </p>
                  </div>
                </div>
              )}

              {/* Grid Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left Side Info */}
                <div className="space-y-4">
                  
                  {/* Delivery Boy Details Card */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Delivery Partner</p>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl border border-slate-100">
                        <User className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{selectedRequest.deliveryName}</p>
                        <p className="text-xs text-slate-500 font-semibold">ID: <span className="font-mono text-slate-700">{selectedRequest.deliveryPartnerIdString}</span></p>
                        <p className="text-xs text-slate-500 font-semibold">Phone: <span className="text-slate-700">{selectedRequest.deliveryPhone}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction info */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Method Used</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getMethodBadgeColor(selectedRequest.depositType)}`}>
                          {getMethodLabel(selectedRequest.depositType)}
                        </span>
                      </div>
                    </div>

                    {selectedRequest.depositType === "zone_hub" && (
                      <div className="pt-2.5 border-t border-slate-200/60">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Zone & Flagship Hub Details</p>
                        <p className="text-xs font-extrabold text-slate-700 mt-1">
                          Zone: <span className="text-slate-900 font-black">{selectedRequest.zoneName || "N/A"}</span>
                        </p>
                        <p className="text-xs font-extrabold text-slate-700 mt-1">
                          Hub Outlet: <span className="text-slate-900 font-black">{selectedRequest.zoneHubName || "N/A"}</span>
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">Hub ID: {selectedRequest.zoneHubDisplayId || "N/A"}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date & Time Submitted</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(selectedRequest.createdAt)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paid Amount</p>
                      <p className="text-2xl font-black text-slate-900 mt-0.5 flex items-center">
                        <IndianRupee className="w-5 h-5 text-slate-500 shrink-0" />
                        {selectedRequest.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                </div>

                {/* Right Side: Proof screenshot preview */}
                <div className="flex flex-col justify-between">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 h-full flex flex-col">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Uploaded Payment Proof</p>
                    
                    {selectedRequest.paymentProof ? (
                      <div className="relative flex-1 group overflow-hidden rounded-xl border border-slate-200 bg-white max-h-[220px] min-h-[160px] flex items-center justify-center">
                        <img
                          src={selectedRequest.paymentProof}
                          alt="Uploaded receipt proof"
                          className="w-full h-full object-contain cursor-pointer transition-transform duration-300 hover:scale-105"
                          onClick={() => setLightboxImage(selectedRequest.paymentProof)}
                        />
                        <div 
                          className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer pointer-events-none"
                        >
                          <span className="bg-white/95 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            Click to Zoom
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl py-8">
                        <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-400 font-semibold">No payment proof uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Note input (Always show, editable for pending, show saved for completed/failed) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">
                  Admin Internal Audit Note
                </label>
                {selectedRequest.status === "Pending" ? (
                  <textarea
                    rows={3}
                    placeholder="Enter audit validation comments, bank transaction reference codes, or reason for rejection..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    disabled={submittingAction}
                    className="w-full p-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:opacity-50"
                  />
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 font-medium italic">
                    {selectedRequest.adminNote || "No audit comment entered."}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div>
                {selectedRequest.status !== "Pending" && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                    selectedRequest.status === "Completed"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : "bg-rose-50 text-rose-700 border border-rose-100"
                  }`}>
                    {selectedRequest.status === "Completed" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    Audited State: {selectedRequest.status === "Completed" ? "Approved" : "Rejected"}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCloseDetails}
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  Close
                </button>
                
                {selectedRequest.status === "Pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleProcessRequest("Failed")}
                      disabled={submittingAction}
                      className="px-4 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submittingAction ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      Reject Request
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProcessRequest("Completed")}
                      disabled={submittingAction}
                      className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submittingAction ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Approve & Settle
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Modal (For Zooming Payment Receipt) */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/90 flex flex-col items-center justify-center p-4 transition-all duration-300 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-colors focus:outline-none"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="max-w-3xl max-h-[85vh] w-full flex items-center justify-center">
            <img
              src={lightboxImage}
              alt="Expanded payment proof receipt"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/5 cursor-zoom-out select-none"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxImage(null)
              }}
            />
          </div>
          
          <p className="text-white/60 text-xs font-medium mt-4 select-none">
            Click anywhere or press close to exit full screen
          </p>
        </div>
      )}
    </div>
  )
}
