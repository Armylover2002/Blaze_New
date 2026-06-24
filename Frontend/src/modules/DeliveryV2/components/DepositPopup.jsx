import { useState, useEffect } from "react"
import { 
  IndianRupee, 
  Loader2, 
  CreditCard, 
  Landmark, 
  QrCode, 
  MapPin, 
  Copy, 
  Upload, 
  Check, 
  ArrowLeft, 
  Wallet,
  ShieldCheck,
  Smartphone,
  Building,
  Info,
  Search
} from "lucide-react"
import { deliveryAPI } from "@food/api"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@common/utils/businessSettings"

export default function DepositPopup({ onSuccess, cashInHand = 0 }) {
  const [step, setStep] = useState(1) // 1: Amount Summary, 2: Payment Mode Selection, 3: Direct Admin details / Hub details
  const [paymentMode, setPaymentMode] = useState("") // "online" | "admin" | "hub"
  const [adminTab, setAdminTab] = useState("bank") // "bank" | "upi" | "qr"
  const [proofFile, setProofFile] = useState(null)
  const [proofFileName, setProofFileName] = useState("")
  const [copiedField, setCopiedField] = useState("")
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [fetchingWallet, setFetchingWallet] = useState(true)

  // Zone & Hub selectors states
  const [zones, setZones] = useState([])
  const [loadingZones, setLoadingZones] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState("")
  
  const [hubs, setHubs] = useState([])
  const [loadingHubs, setLoadingHubs] = useState(false)
  const [selectedHubId, setSelectedHubId] = useState("")
  const [hubSearchQuery, setHubSearchQuery] = useState("")

  const filteredZones = zones.filter((z) =>
    (z.zoneName || z.name || "").toLowerCase().includes(hubSearchQuery.toLowerCase())
  )

  // Fetch zones on step 3 mount if paymentMode is hub
  useEffect(() => {
    if (paymentMode === "hub" && step === 3) {
      const fetchZones = async () => {
        try {
          setLoadingZones(true)
          const res = await deliveryAPI.getDepositZones()
          if (res?.data?.success && res.data.data?.zones) {
            setZones(res.data.data.zones)
          }
        } catch (err) {
          console.error("Failed to load zones for deposit:", err)
          toast.error("Failed to load available zones")
        } finally {
          setLoadingZones(false)
        }
      }
      fetchZones()
    }
  }, [paymentMode, step])

  // Fetch hubs when zone changes
  useEffect(() => {
    if (!selectedZoneId) {
      setHubs([])
      setSelectedHubId("")
      return
    }
    const fetchHubs = async () => {
      try {
        setLoadingHubs(true)
        const res = await deliveryAPI.getDepositZoneHubs(selectedZoneId)
        if (res?.data?.success && res.data.data?.hubs) {
          setHubs(res.data.data.hubs)
          setSelectedHubId("")
        }
      } catch (err) {
        console.error("Failed to load zone hubs:", err)
        toast.error("Failed to load hubs for selected zone")
      } finally {
        setLoadingHubs(false)
      }
    }
    fetchHubs()
  }, [selectedZoneId])

  useEffect(() => {
    const loadWallet = async () => {
      try {
        setFetchingWallet(true)
        const res = await deliveryAPI.getWallet()
        if (res?.data?.success) {
          setWallet(res.data.data.wallet)
        }
      } catch (err) {
        console.error("Failed to load wallet inside deposit popup:", err)
      } finally {
        setFetchingWallet(false)
      }
    }
    loadWallet()
  }, [])

  const cashInHandNum = Number(cashInHand) || 0

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard!`)
    setTimeout(() => setCopiedField(""), 2000)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size cannot exceed 5MB")
        return
      }
      setProofFile(file)
      setProofFileName(file.name)
      toast.success("Receipt image selected successfully")
    }
  }

  // razorpay online flow
  const handleOnlinePayment = async () => {
    try {
      setLoading(true)
      const orderRes = await deliveryAPI.createDepositOrder(cashInHandNum)
      const data = orderRes?.data?.data
      const rp = data?.razorpay
      if (!rp?.orderId || !rp?.key) {
        toast.error("Payment gateway not ready. Please try again.")
        setLoading(false)
        return
      }
      setLoading(false)

      let profile = {}
      try {
        const pr = await deliveryAPI.getProfile()
        profile = pr?.data?.data?.profile || pr?.data?.profile || {}
      } catch (_) {}

      const phone = (profile?.phone || "").replace(/\D/g, "").slice(-10)
      const email = profile?.email || ""
      const name = profile?.name || ""

      const companyName = await getCompanyNameAsync()
      setProcessing(true)
      await initRazorpayPayment({
        key: rp.key,
        amount: rp.amount,
        currency: rp.currency || "INR",
        order_id: rp.orderId,
        name: companyName,
        description: `Cash limit deposit - ₹${cashInHandNum.toFixed(2)}`,
        prefill: { name, email, contact: phone },
        handler: async (res) => {
          try {
            const verifyRes = await deliveryAPI.verifyDepositPayment({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              amount: cashInHandNum
            })
            if (verifyRes?.data?.success) {
              toast.success(`Deposit of ₹${cashInHandNum.toFixed(2)} successful. Available limit updated.`)
              window.dispatchEvent(new CustomEvent("deliveryWalletStateUpdated"))
              if (onSuccess) onSuccess()
            } else {
              toast.error(verifyRes?.data?.message || "Verification failed")
            }
          } catch (err) {
            toast.error(err?.response?.data?.message || "Verification failed. Contact support.")
          } finally {
            setProcessing(false)
          }
        },
        onError: (e) => {
          toast.error(e?.description || "Payment failed")
          setProcessing(false)
        },
        onClose: () => setProcessing(false)
      })
    } catch (err) {
      setLoading(false)
      setProcessing(false)
      toast.error(err?.response?.data?.message || "Failed to create payment")
    }
  }

  // manual upload / zone hub flow
  const handleManualSubmission = async (depositType) => {
    if (!proofFile) {
      toast.error("Please upload payment receipt image as proof")
      return
    }
    if (depositType === 'zone_hub' && (!selectedZoneId || !selectedHubId)) {
      toast.error("Please select a Zone and a Hub restaurant")
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append("amount", cashInHandNum.toString())
      formData.append("depositType", depositType)
      if (proofFile) {
        formData.append("paymentProof", proofFile)
      }
      if (depositType === 'zone_hub') {
        formData.append("zoneId", selectedZoneId)
        formData.append("zoneHubRestaurantId", selectedHubId)
      }

      const res = await deliveryAPI.submitManualDeposit(formData)
      if (res?.data?.success) {
        toast.success(
          depositType === 'zone_hub'
            ? "Handover request submitted successfully! Awaiting Hub settle."
            : "Deposit proof submitted successfully! Awaiting Admin approval."
        )
        window.dispatchEvent(new CustomEvent("deliveryWalletStateUpdated"))
        if (onSuccess) onSuccess()
      } else {
        toast.error(res?.data?.message || "Failed to submit request")
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit deposit request")
    } finally {
      setLoading(false)
    }
  }

  if (fetchingWallet) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0000] mb-3" />
        <p className="text-xs text-slate-500 font-semibold animate-pulse">Loading wallet balance...</p>
      </div>
    )
  }

  if (wallet?.pendingManualDeposit) {
    const pd = wallet.pendingManualDeposit
    const dateFormatted = new Date(pd.createdAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    
    const getMethodName = (type) => {
      switch (type) {
        case "admin_bank": return "Bank Transfer"
        case "admin_upi": return "UPI Payment"
        case "admin_qr": return "QR Code Scan"
        case "zone_hub": return "Zone Hub Handover"
        default: return type
      }
    }

    return (
      <div className="p-5 flex flex-col space-y-5 text-slate-900 bg-white">
        <div className="bg-amber-50/75 border border-amber-200/60 rounded-2xl p-5 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-20 h-20 bg-amber-500/5 rounded-full" />
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-3 animate-pulse">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-extrabold text-slate-900 text-base">Request Under Audit</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Status: Pending Approval</p>
          
          <div className="w-full border-t border-dashed border-slate-200/60 my-4" />
          
          <div className="w-full space-y-2.5 text-left text-xs font-semibold text-slate-600">
            <div className="flex justify-between">
              <span>Deposited Amount:</span>
              <span className="font-black text-slate-950">₹{Number(pd.amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold text-slate-800">{getMethodName(pd.depositType)}</span>
            </div>
            <div className="flex justify-between">
              <span>Date Submitted:</span>
              <span className="font-bold text-slate-800">{dateFormatted}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs text-slate-500 font-medium leading-relaxed">
          💡 **Please Note**: You already have an active pending deposit request submitted. 
          Please wait while the admin verifies your screenshot proof and approves the settlement. 
          You will be able to make new deposits after this request is processed.
        </div>
      </div>
    )
  }

  if (cashInHandNum <= 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 text-base">No Outstanding Balance</h3>
        <p className="text-xs text-slate-500 max-w-[240px]">
          Your Cash in Hand is ₹0.00. No deposits are required at this moment.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-white overflow-hidden h-full w-full text-slate-900">
      
      {/* STEP 1: SUMMARY & CONFIRM AMOUNT */}
      {step === 1 && (
        <div className="p-5 flex flex-col space-y-5">
          <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-5 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-20 h-20 bg-emerald-500/5 rounded-full" />
            <div className="w-10 h-10 rounded-full bg-[#FF0000]/10 flex items-center justify-center text-[#FF0000] mb-3">
              <Wallet className="w-5 h-5" />
            </div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Amount to Deposit</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
              ₹{cashInHandNum.toFixed(2)}
            </p>
            
            <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/60 border border-slate-300/40 text-[10px] font-semibold text-slate-550">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF0000] animate-pulse" />
              Locked & Balanced
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Unified Deposit amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
              <input
                type="text"
                disabled
                readOnly
                value={cashInHandNum.toFixed(2)}
                className="w-full pl-8 pr-3 py-3 border border-slate-200 bg-slate-50 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-normal pt-1">
              * The deposit amount matches exactly your total Cash in Hand. This amount cannot be changed by the delivery boy.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-3.5 bg-black text-white hover:bg-slate-900 active:scale-[0.98] font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            Proceed to Pay
          </button>
        </div>
      )}

      {/* STEP 2: CHOOSE PAYMENT MODE */}
      {step === 2 && (
        <div className="p-5 flex flex-col space-y-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setStep(1)} 
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold text-slate-800">Select Settlement Mode</h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Mode 1: Online */}
            <button
              onClick={() => {
                setPaymentMode("online")
                handleOnlinePayment()
              }}
              disabled={loading || processing}
              className="flex items-center gap-4 p-4 border border-slate-200/80 hover:border-slate-400 rounded-2xl bg-white text-left transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 leading-tight">Online Payment</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">Settle instantly using UPI, Credit/Debit cards, or Netbanking.</p>
              </div>
            </button>

            {/* Mode 2: Admin Details */}
            <button
              onClick={() => {
                setPaymentMode("admin")
                setStep(3)
              }}
              className="flex items-center gap-4 p-4 border border-slate-200/80 hover:border-slate-400 rounded-2xl bg-white text-left transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 leading-tight">Admin Details</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">Bank Transfer, UPI ID or scan QR code and upload deposit proof.</p>
              </div>
            </button>

            {/* Mode 3: Zone Hub */}
            <button
              onClick={() => {
                setPaymentMode("hub")
                setStep(3)
              }}
              className="flex items-center gap-4 p-4 border border-slate-200/80 hover:border-slate-400 rounded-2xl bg-white text-left transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 leading-tight">Zone Hub</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">Hand over physical cash to the Hub Manager in your assigned hub.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUB-VIEWS (ADMIN DETAILS OR ZONE HUB) */}
      {step === 3 && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <button 
              onClick={() => setStep(2)} 
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900">
              {paymentMode === "admin" ? "Direct Admin Settlement" : "Zone Hub Settlement"}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            
            {/* SUB-VIEW 1: ADMIN DETAILS */}
            {paymentMode === "admin" && (
              <div className="space-y-4">
                
                {/* Switch Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAdminTab("bank")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      adminTab === "bank" ? "bg-white text-black shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Bank Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab("upi")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      adminTab === "upi" ? "bg-white text-black shadow-sm" : "text-slate-500"
                    }`}
                  >
                    UPI ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab("qr")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      adminTab === "qr" ? "bg-white text-black shadow-sm" : "text-slate-500"
                    }`}
                  >
                    QR Code
                  </button>
                </div>

                {/* Tab content 1: Bank Details */}
                {adminTab === "bank" && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</p>
                        <p className="text-xs font-bold text-slate-900">HDFC Bank Limited</p>
                      </div>
                      <button 
                        onClick={() => handleCopy("HDFC Bank Limited", "Bank Name")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "Bank Name" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Account Holder</p>
                        <p className="text-xs font-bold text-slate-900">Itzo Technologies Private Limited</p>
                      </div>
                      <button 
                        onClick={() => handleCopy("Itzo Technologies Private Limited", "Account Holder")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "Account Holder" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Account Number</p>
                        <p className="text-xs font-extrabold text-slate-900 font-mono">50200084321948</p>
                      </div>
                      <button 
                        onClick={() => handleCopy("50200084321948", "Account Number")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "Account Number" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</p>
                        <p className="text-xs font-extrabold text-slate-900 font-mono">HDFC0000124</p>
                      </div>
                      <button 
                        onClick={() => handleCopy("HDFC0000124", "IFSC Code")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "IFSC Code" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab content 2: UPI ID */}
                {adminTab === "upi" && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Admin UPI ID</p>
                      <p className="text-sm font-extrabold text-slate-950 mt-1 font-mono tracking-wide">itzopay@icici</p>
                    </div>
                    <button
                      onClick={() => handleCopy("itzopay@icici", "UPI ID")}
                      className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5 hover:bg-slate-50 active:scale-[0.98] transition-all"
                    >
                      {copiedField === "UPI ID" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy UPI ID
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Tab content 3: QR Code */}
                {adminTab === "qr" && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
                    {/* Render a premium styled QR SVG */}
                    <div className="w-36 h-36 bg-white p-2 border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center">
                      <svg width="128" height="128" viewBox="0 0 29 29" fill="none" className="text-slate-900 shrink-0">
                        <path d="M0 0h7v7H0V0zm1 1v5h5V1H1zm1 1h3v3H2V2zm6-2h1v1H8V0zm2 0h1v2h-1V0zm1 0h2v1h-2V0zm3 0h1v1h-1V0zm1 0h3v1h-3V0zm4 0h1v2h-1V0zm1 0h3v3h-3V0zm2 1h1v1h-1V1zm-8 1h1v1h-1V2zm1 0h1v1h-1V2zm2 0h1v2h-1V2zm2 0h1v1h-1V2zm-9 1h1v1H8V3zm1 0h1v1h-1V3zm2 0h1v1h-1V3zm7 0h1v1h-1V3zm-14 2h1v2H2V5zm1 0h3v1H3V5zm0 2h3v1H3V7zm11-2h1v1h-1V5zm1 0h2v1h-2V5zm3 0h1v2h-1V5zm1 0h1v1h-1V5zm1 0h2v1h-2V5zm-9 1h1v1h-1V6zm2 0h1v1h-1V6zm5 0h1v2h-1V6zm-17 3h1v1H0V9zm1 0h2v2H1V9zm3 0h2v1H4V9zm2 0h1v1H6V9zm2 0h1v2H8V9zm2 0h2v1h-2V9zm4 0h1v1h-1V9zm1 0h1v1h-1V9zm3 0h1v1h-1V9zm2 0h3v1h-3V9zm-18 1h1v1H2v-1zm2 0h1v1H4v-1zm9 0h2v1h-2v-1zm4 0h1v1h-1v-1zm1 0h2v1h-2v-1zm-15 1h1v1H3v-1zm2 0h1v1H5v-1zm1 0h1v1H6v-1zm3 0h1v1H9v-1zm1 0h1v1h-1v-1zm3 0h1v1h-1v-1zm4 0h1v1h-1v-1zm1 0h2v1h-2v-1zm1 0h2v1h-2v-1zm-18 1h1v1H0v-1zm1 0h1v1H1v-1zm6 0h1v1H7v-1zm4 0h1v1h-1v-1zm2 0h2v1h-2v-1zm4 0h1v1h-1v-1zm1 0h2v1h-2v-1zm2 0h3v1h-3v-1zm-19 1h2v1H1v-1zm2 0h1v1H3v-1zm2 0h1v1H5v-1zm2 0h1v1H7v-1zm3 0h2v1h-2v-1zm2 0h1v1h-1v-1zm2 0h1v1h-1v-1zm4 0h1v1h-1v-1zm1 0h1v1h-1v-1zm-19 1h1v2H0v-2zm2 0h1v1H2v-1zm2 0h3v1H4v-1zm4 0h1v1H8v-1zm1 0h2v2H9v-2zm3 0h1v1h-1v-1zm2 0h2v1h-2v-1zm2 0h2v2h-2v-2zm3 0h1v1h-1v-1zm-18 1h2v1H2v-1zm4 0h1v1H6v-1zm6 0h1v1h-1v-1zm3 0h1v1h-1v-1zm1 0h2v1h-2v-1zm4 0h1v1h-1v-1zm-18 1h1v1H0v-1zm3 0h1v1H3v-1zm2 0h2v1H5v-1zm2 0h1v1H7v-1zm1 0h1v1H8v-1zm3 0h1v1h-1v-1zm2 0h1v1h-1v-1zm2 0h1v1h-1v-1zm2 0h2v1h-2v-1zm1 0h1v1h-1v-1zm2 0h1v1h-1v-1z" fill="currentColor" />
                      </svg>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold max-w-[200px] leading-snug">
                      Scan the QR code above with any UPI app (GPay, PhonePe, Paytm) to transfer the amount.
                    </p>
                  </div>
                )}

                {/* Upload proof block */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Upload Payment Receipt Proof <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="relative border-2 border-dashed border-slate-250 hover:border-slate-400 transition-colors rounded-2xl bg-slate-50 overflow-hidden">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <div className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          {proofFileName ? "Replace receipt image" : "Upload transaction screenshot"}
                        </p>
                        <p className="text-[10px] text-slate-400">JPG, PNG up to 5MB</p>
                      </div>
                    </div>
                  </div>

                  {proofFileName && (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-250 rounded-xl">
                      <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs font-bold text-emerald-800 truncate flex-1">{proofFileName}</p>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => handleManualSubmission(adminTab === 'bank' ? 'admin_bank' : adminTab === 'upi' ? 'admin_upi' : 'admin_qr')}
                  disabled={loading || !proofFile}
                  className="w-full mt-3 py-3.5 bg-black text-white hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading Proof…
                    </>
                  ) : "Submit Payment Proof"}
                </button>
              </div>
            )}

            {/* SUB-VIEW 2: ZONE HUB */}
            
            {/* Screen A: Zone Selection (full page inside modal area) */}
            {paymentMode === "hub" && !selectedZoneId && (
              <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">1. Select Zone</h4>
                  {loadingZones && (
                    <span className="text-[10px] text-[#FF0000] font-semibold animate-pulse">Loading...</span>
                  )}
                </div>

                {/* Search Box */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search operational zones..."
                    value={hubSearchQuery}
                    onChange={(e) => setHubSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF0000]/20 focus:border-[#FF0000] transition-all text-xs"
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                </div>

                {/* Full-Height Zones List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-sm min-h-[350px]">
                  {loadingZones ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-[#FF0000] mb-2" />
                      <span className="text-xs font-medium">Fetching active zones...</span>
                    </div>
                  ) : filteredZones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <MapPin className="w-10 h-10 text-slate-350 mb-2" />
                      <span className="text-xs font-medium">{hubSearchQuery ? "No matching zones found" : "No active zones available"}</span>
                    </div>
                  ) : (
                    filteredZones.map((z) => {
                      const zId = z._id || z.id;
                      return (
                        <button
                          key={zId}
                          type="button"
                          onClick={() => {
                            setSelectedZoneId(zId);
                            setHubSearchQuery(""); // Clear search for subsequent screens
                          }}
                          className="w-full text-left px-5 py-4 text-xs font-medium hover:bg-red-50/50 hover:text-[#FF0000] transition-all flex items-center justify-between text-slate-800 active:bg-red-50"
                        >
                          <span>{z.zoneName || z.name}</span>
                          <span className="w-5 h-5 rounded-full bg-slate-50 hover:bg-red-100 flex items-center justify-center text-slate-400 group-hover:text-[#FF0000] transition-colors">
                            →
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Screen B: Restaurant Hub Selection (full page inside modal area) */}
            {paymentMode === "hub" && selectedZoneId && !selectedHubId && (
              <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-200">
                
                {/* Header with Back button */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedZoneId("")}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors flex items-center justify-center border border-slate-200 shadow-sm bg-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="text-[9px] font-bold text-[#FF0000] uppercase tracking-wider block">
                      Zone: {zones.find(z => (z._id || z.id) === selectedZoneId)?.zoneName || zones.find(z => (z._id || z.id) === selectedZoneId)?.name || "Selected Zone"}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800">Select Zone Hub Restaurant</h4>
                  </div>
                </div>

                {/* Full-Height Restaurant List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-sm min-h-[350px]">
                  {loadingHubs ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-[#FF0000] mb-2" />
                      <span className="text-xs font-medium">Loading zone hubs...</span>
                    </div>
                  ) : hubs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 p-6 text-center text-slate-450">
                      <Building className="w-10 h-10 text-slate-300 mb-2" />
                      <span className="text-xs font-semibold text-slate-700">No designated hubs found</span>
                      <span className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                        There are no flagship hub restaurants configured for this zone yet. Please contact support.
                      </span>
                    </div>
                  ) : (
                    hubs.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHubId(h.id)}
                        className="w-full text-left px-5 py-4 hover:bg-red-50/50 transition-all flex items-center justify-between group active:bg-red-50"
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold block text-slate-800 group-hover:text-[#FF0000] transition-colors">
                            {h.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">ID: {h.displayId || "N/A"}</span>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[220px]">{h.address}</span>
                        </div>
                        <span className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#FF0000] transition-colors">
                          →
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Screen C: Proof Upload & Handover Confirmation (full page inside modal area) */}
            {paymentMode === "hub" && selectedZoneId && selectedHubId && (
              (() => {
                const selectedHub = hubs.find(h => h.id === selectedHubId)
                if (!selectedHub) return null
                return (
                  <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-200">
                    
                    {/* Header with Back button */}
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedHubId("")}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors flex items-center justify-center border border-slate-200 shadow-sm bg-white"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <span className="text-[9px] font-bold text-[#FF0000] uppercase tracking-wider block">
                          Outlet: {selectedHub.name}
                        </span>
                        <h4 className="text-xs font-semibold text-slate-800">Add Handover Proof</h4>
                      </div>
                    </div>

                    {/* Scrollable details and file upload fields */}
                    <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                      
                      {/* Hub Profile Details Card */}
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3.5 text-xs text-slate-700">
                        <div className="flex items-center gap-2 border-b border-slate-200/50 pb-2">
                          <Building className="w-4 h-4 text-[#FF0000]" />
                          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Zone Hub Profile</span>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-medium text-slate-500 uppercase">Outlet Name</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedHub.name}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-medium text-slate-500 uppercase">Hub Manager</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{selectedHub.owner}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-slate-500 uppercase">Manager Phone</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{selectedHub.phone}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-medium text-slate-500 uppercase">Handover Address</p>
                          <p className="font-medium text-slate-700 leading-normal mt-0.5">{selectedHub.address}</p>
                        </div>

                        <div className="bg-amber-50 border border-amber-250/60 rounded-xl p-3 flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[9px] text-amber-700 leading-normal font-medium">
                            Hand over exactly <span className="font-bold font-mono">₹{cashInHandNum.toFixed(2)}</span> to the manager. Settle the cash, take a screenshot of transaction receipt or handover proof photo, and upload it below.
                          </p>
                        </div>
                      </div>

                      {/* Payment Proof Upload field */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                          Upload Handover Receipt Proof <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="relative border-2 border-dashed border-slate-250 hover:border-slate-400 transition-colors rounded-2xl bg-slate-50 overflow-hidden">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <div className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500">
                              <Upload className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-800">
                                {proofFileName ? "Replace receipt image" : "Upload transaction proof"}
                              </p>
                              <p className="text-[10px] text-slate-400">JPG, PNG up to 5MB</p>
                            </div>
                          </div>
                        </div>

                        {proofFileName && (
                          <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-250 rounded-xl animate-in slide-in-from-bottom-2 duration-200">
                            <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-xs font-semibold text-emerald-800 truncate flex-1">{proofFileName}</p>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={() => handleManualSubmission('zone_hub')}
                      disabled={loading || !proofFile}
                      className="w-full py-3.5 bg-black text-white hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 uppercase tracking-wider mt-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting…
                        </>
                      ) : "Submit Hub Settlement Request"}
                    </button>

                  </div>
                )
              })()
            )}

          </div>
        </div>
      )}

    </div>
  )
}
