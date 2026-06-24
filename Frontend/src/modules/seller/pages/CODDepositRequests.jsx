import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Card from "@shared/components/ui/Card"
import Badge from "@shared/components/ui/Badge"
import Button from "@shared/components/ui/Button"
import Modal from "@shared/components/ui/Modal"
import {
  HiOutlineInbox,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlinePhoto,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineCalendar,
  HiOutlineArrowPath,
} from "react-icons/hi2"
import { toast } from "sonner"
import { sellerApi } from "../services/sellerApi"

const CODDepositRequests = () => {
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedDeposit, setSelectedDeposit] = useState(null)
  
  // Modals state
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  // Fields state
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState("")
  const [sellerNote, setSellerNote] = useState("")

  useEffect(() => {
    fetchDeposits()
  }, [])

  const fetchDeposits = async () => {
    try {
      setLoading(true)
      const response = await sellerApi.getCODDeposits()
      if (response.data?.success && response.data.result) {
        setDeposits(response.data.result)
      }
    } catch (error) {
      console.error("Error fetching COD deposits:", error)
      toast.error("Failed to load cash deposit requests")
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setProofFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProofPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAcceptSubmit = async (e) => {
    e.preventDefault()
    if (!proofFile) {
      toast.error("Please upload a cash confirmation proof image")
      return
    }

    try {
      setActionLoading(true)
      const formData = new FormData()
      formData.append("action", "accept")
      formData.append("sellerNote", sellerNote)
      formData.append("sellerProof", proofFile)

      const response = await sellerApi.processCODDeposit(selectedDeposit._id, formData)
      if (response.data?.success) {
        toast.success("COD cash handover accepted successfully!")
        setIsAcceptModalOpen(false)
        resetForm()
        fetchDeposits()
      }
    } catch (error) {
      console.error("Error accepting deposit:", error)
      toast.error(error.response?.data?.message || "Failed to accept deposit")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    if (!sellerNote.trim()) {
      toast.error("Please add a note explaining the discrepancy")
      return
    }

    try {
      setActionLoading(true)
      const formData = new FormData()
      formData.append("action", "reject")
      formData.append("sellerNote", sellerNote)

      const response = await sellerApi.processCODDeposit(selectedDeposit._id, formData)
      if (response.data?.success) {
        toast.success("COD cash handover rejected successfully")
        setIsRejectModalOpen(false)
        resetForm()
        fetchDeposits()
      }
    } catch (error) {
      console.error("Error rejecting deposit:", error)
      toast.error(error.response?.data?.message || "Failed to reject deposit")
    } finally {
      setActionLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedDeposit(null)
    setProofFile(null)
    setProofPreview("")
    setSellerNote("")
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "Pending":
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 py-1 px-2.5 font-bold uppercase tracking-wider text-[10px] rounded flex items-center gap-1 shrink-0">
            <HiOutlineClock className="w-3.5 h-3.5" /> Pending Confirmation
          </Badge>
        )
      case "Seller_Accepted":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 py-1 px-2.5 font-bold uppercase tracking-wider text-[10px] rounded flex items-center gap-1 shrink-0">
            <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Accepted (Pending Admin)
          </Badge>
        )
      case "Completed":
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200 py-1 px-2.5 font-bold uppercase tracking-wider text-[10px] rounded flex items-center gap-1 shrink-0">
            <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Settle Complete
          </Badge>
        )
      case "Seller_Rejected":
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 py-1 px-2.5 font-bold uppercase tracking-wider text-[10px] rounded flex items-center gap-1 shrink-0">
            <HiOutlineXCircle className="w-3.5 h-3.5" /> Rejected by Store
          </Badge>
        )
      case "Failed":
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200 py-1 px-2.5 font-bold uppercase tracking-wider text-[10px] rounded flex items-center gap-1 shrink-0">
            <HiOutlineXCircle className="w-3.5 h-3.5" /> Settle Failed
          </Badge>
        )
      default:
        return <Badge className="bg-slate-100 text-slate-700 py-1 px-2.5 rounded text-[10px]">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6 pb-16 p-4 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
            COD Cash Handovers
            <Badge className="text-[10px] sm:text-xs px-2 py-0 bg-red-100 text-red-700 border-none font-bold tracking-wider uppercase rounded">
              Physical Settlement
            </Badge>
          </h1>
          <p className="text-slate-600 text-sm mt-0.5 font-medium">
            Confirm or reject cash collection requests submitted by geofenced delivery partners.
          </p>
        </div>

        <Button
          onClick={fetchDeposits}
          variant="outline"
          className="rounded-lg py-2.5 px-4 font-semibold text-slate-700 flex items-center gap-2 border bg-white shrink-0 hover:bg-slate-50"
        >
          <HiOutlineArrowPath className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh List</span>
        </Button>
      </div>

      {/* Main workspace */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh] font-bold text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mr-3"></div>
          LOADING DEPOSITS...
        </div>
      ) : deposits.length === 0 ? (
        <Card className="border-none shadow-sm rounded-lg p-16 text-center bg-white flex flex-col items-center justify-center">
          <HiOutlineInbox className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">No COD handovers yet</h3>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md">
            Cash collected by riders inside your zone will show up here for verification when they make physical submissions at your store counter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {deposits.map((item) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                  <div className="space-y-4 flex-1">
                    
                    {/* Upper row: amount & status */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                        ₹{item.amount.toLocaleString("en-IN")}
                      </span>
                      {getStatusBadge(item.status)}
                      <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <HiOutlineCalendar className="w-4 h-4" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {/* Middle details: rider details */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Delivery Partner</span>
                        <div className="text-sm font-extrabold text-slate-800 mt-0.5">{item.deliveryPartnerId?.name || "N/A"}</div>
                        <div className="text-xs text-slate-500 font-medium">Phone: {item.deliveryPartnerId?.phone || "N/A"}</div>
                      </div>

                      {item.paymentProof && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Rider Handover Receipt</span>
                          <button
                            onClick={() => {
                              setSelectedDeposit(item)
                              setIsPreviewModalOpen(true)
                            }}
                            className="mt-1 flex items-center gap-1.5 text-xs text-red-600 font-bold bg-red-50 px-2.5 py-1.5 rounded hover:bg-red-100 transition-colors"
                          >
                            <HiOutlinePhoto className="w-4 h-4" /> View Rider Invoice
                          </button>
                        </div>
                      )}

                      {item.sellerNote && (
                        <div className="sm:col-span-2 md:col-span-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Store Confirmation Note</span>
                          <p className="text-xs text-slate-600 font-medium italic mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                            "{item.sellerNote}"
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Actions bar */}
                  {item.status === "Pending" && (
                    <div className="flex sm:flex-row md:flex-col gap-2 shrink-0 self-stretch sm:self-auto justify-end">
                      <Button
                        onClick={() => {
                          setSelectedDeposit(item)
                          setIsRejectModalOpen(true)
                        }}
                        variant="outline"
                        disabled={actionLoading}
                        className="rounded-lg py-2.5 px-4 font-bold border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center justify-center gap-1.5 flex-1"
                      >
                        <HiOutlineXCircle className="w-4 h-4" /> Reject
                      </Button>
                      
                      <Button
                        onClick={() => {
                          setSelectedDeposit(item)
                          setIsAcceptModalOpen(true)
                        }}
                        disabled={actionLoading}
                        className="rounded-lg py-2.5 px-5 font-bold bg-[#0c831f] hover:bg-[#0a6e19] text-white flex items-center justify-center gap-1.5 flex-1 shadow-sm"
                      >
                        <HiOutlineCheckCircle className="w-4 h-4" /> Accept Cash
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Accept Cash Submission Modal */}
      <Modal
        isOpen={isAcceptModalOpen}
        onClose={() => {
          setIsAcceptModalOpen(false)
          resetForm()
        }}
        title="Confirm Cash Receipt"
      >
        {selectedDeposit && (
          <form onSubmit={handleAcceptSubmit} className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-150 text-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Confirming Cash Handover From</span>
              <h3 className="text-base font-extrabold text-slate-800 mt-1">{selectedDeposit.deliveryPartnerId?.name}</h3>
              <h2 className="text-3xl font-black text-[#0c831f] tracking-tight mt-2">
                ₹{selectedDeposit.amount.toLocaleString("en-IN")}
              </h2>
            </div>

            {/* File uploader */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Upload Store Confirmed Invoice / Receipt *
              </label>
              
              <div className="border-2 border-dashed border-slate-300 hover:border-[#0c831f] rounded-xl p-6 text-center cursor-pointer transition-colors relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  required
                />
                {proofPreview ? (
                  <div className="relative h-32 w-full max-w-xs mx-auto overflow-hidden rounded-lg border border-slate-200">
                    <img src={proofPreview} alt="Receipt preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Replace Image
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-slate-500">
                    <HiOutlinePhoto className="w-10 h-10 mx-auto text-slate-400 group-hover:text-[#0c831f] transition-colors" />
                    <div className="text-sm font-bold">Click or drag receipt photo to upload</div>
                    <div className="text-xs text-slate-400">Supported formats: JPG, PNG, WEBP (Max 5MB)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation notes */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Store Confirmation Note (Optional)
              </label>
              <textarea
                placeholder="Add store invoice ID or handover confirmation details..."
                value={sellerNote}
                onChange={(e) => setSellerNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsAcceptModalOpen(false)
                  resetForm()
                }}
                className="rounded-lg py-3 font-semibold bg-white"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-lg py-3 font-bold bg-[#0c831f] hover:bg-[#0a6e19] text-white shadow-sm"
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Confirm & Accept"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reject Handover Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false)
          resetForm()
        }}
        title="Reject Cash Handover"
      >
        {selectedDeposit && (
          <form onSubmit={handleRejectSubmit} className="space-y-6">
            <div className="bg-rose-50/50 p-4 rounded-lg border border-rose-100 text-center">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">Rejecting Cash Handover From</span>
              <h3 className="text-base font-extrabold text-slate-800 mt-1">{selectedDeposit.deliveryPartnerId?.name}</h3>
              <h2 className="text-3xl font-black text-rose-700 tracking-tight mt-2">
                ₹{selectedDeposit.amount.toLocaleString("en-IN")}
              </h2>
            </div>

            {/* Note fields */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <HiOutlineChatBubbleBottomCenterText className="w-4 h-4 text-rose-500" /> 
                Discrepancy Note *
              </label>
              <textarea
                placeholder="Explain why this request is rejected (e.g. cash amount doesn't match physical count, wrong rider, etc.)..."
                value={sellerNote}
                onChange={(e) => setSellerNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[80px]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false)
                  resetForm()
                }}
                className="rounded-lg py-3 font-semibold bg-white"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-lg py-3 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Submit Rejection"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false)
          resetForm()
        }}
        title="Rider Invoice Preview"
      >
        {selectedDeposit?.paymentProof && (
          <div className="space-y-4 text-center">
            <div className="max-h-[60vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
              <img src={selectedDeposit.paymentProof} alt="Rider Proof" className="max-h-[55vh] object-contain max-w-full" />
            </div>
            <Button
              onClick={() => {
                setIsPreviewModalOpen(false)
                resetForm()
              }}
              className="rounded-lg py-2.5 px-6 font-bold mx-auto"
            >
              Close Preview
            </Button>
          </div>
        )}
      </Modal>

    </div>
  )
}

export default CODDepositRequests
