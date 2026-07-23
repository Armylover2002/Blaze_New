import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Edit2,
  Loader2,
  Plus,
  Trash2,
  X,
  AlertCircle
} from "lucide-react"
import { sellerApi } from "../services/sellerApi"
import { toast } from "sonner"

const defaultFormData = {
  code: "",
  couponType: "generic",
  discountType: "percentage",
  discountValue: "",
  minOrderValue: "",
  maxDiscount: "",
  validFrom: "",
  validTill: "",
  usageLimit: "",
  perUserLimit: "1",
  description: "",
}

const statusBadgeClass = (status) => {
  const value = String(status || "Pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

export default function Coupons() {
  const navigate = useNavigate()
  const goBack = () => navigate(-1)
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await sellerApi.getCoupons()
      const list = response?.data?.data || response?.data?.result || []
      setCoupons(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load coupons")
      setCoupons([])
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setShowModal(false)
    setEditingCoupon(null)
    setFormData(defaultFormData)
  }

  const openCreateModal = () => {
    setEditingCoupon(null)
    setFormData(defaultFormData)
    setShowModal(true)
  }

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon?.code || "",
      couponType: coupon?.couponType || "generic",
      discountType: coupon?.discountType || "percentage",
      discountValue: coupon?.discountValue || "",
      minOrderValue: coupon?.minOrderValue || "",
      maxDiscount: coupon?.maxDiscount || "",
      validFrom: coupon?.validFrom ? new Date(coupon.validFrom).toISOString().split('T')[0] : "",
      validTill: coupon?.validTill ? new Date(coupon.validTill).toISOString().split('T')[0] : "",
      usageLimit: coupon?.usageLimit || "",
      perUserLimit: coupon?.perUserLimit || "1",
      description: coupon?.description || "",
    })
    setShowModal(true)
  }

  const handleSaveCoupon = async () => {
    if (!formData.code.trim()) {
      toast.error("Coupon code is required")
      return
    }
    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      toast.error("Discount value must be greater than 0")
      return
    }
    if (!formData.validFrom || !formData.validTill) {
      toast.error("Valid From and Valid Till dates are required")
      return
    }

    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        couponType: formData.couponType,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : undefined,
        validFrom: new Date(formData.validFrom).toISOString(),
        validTill: new Date(formData.validTill).toISOString(),
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        perUserLimit: formData.perUserLimit ? Number(formData.perUserLimit) : 1,
        description: formData.description.trim()
      }

      if (editingCoupon) {
        await sellerApi.updateCoupon(editingCoupon._id || editingCoupon.id, payload)
        toast.success("Coupon request updated and sent for admin approval")
      } else {
        await sellerApi.createCoupon(payload)
        toast.success("Coupon request submitted and pending admin approval")
      }

      resetModal()
      fetchCoupons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save coupon")
    }
  }

  const handleDeleteCoupon = async (coupon) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${coupon.code}"?`)) return

    try {
      await sellerApi.deleteCoupon(coupon._id || coupon.id)
      toast.success("Coupon deleted successfully")
      fetchCoupons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete coupon")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="rounded-full p-1 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manage Coupons</h1>
            <p className="text-xs text-slate-500">Configure promo codes for Quick Commerce users.</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Campaign Review Queue</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Coupon codes submitted here will be sent to the admin for review. Once approved, the coupons will become active automatically and be shown to users at checkout. Editing a coupon will reset its status to pending.
              </p>
            </div>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={openCreateModal}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 font-semibold text-white shadow-lg shadow-red-600/10 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Create Coupon
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">No coupons created yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Launch your first campaign to boost sales and attract local customers!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => {
              const status = coupon?.status || "Pending"
              const validFromFormatted = coupon?.validFrom ? new Date(coupon.validFrom).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'
              const validTillFormatted = coupon?.validTill ? new Date(coupon.validTill).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'

              return (
                <motion.div
                  key={coupon._id || coupon.id}
                  layout
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm relative overflow-hidden"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900 tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          {coupon.code}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClass(status)}`}>
                          {status === "Approved" ? <BadgeCheck className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                          {status}
                        </span>
                      </div>
                      
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-semibold text-slate-700">
                          Discount: {coupon.discountType === "percentage" ? `${coupon.discountValue}% OFF` : coupon.discountType === 'free_delivery' ? 'Free Delivery' : `₹${coupon.discountValue} FLAT OFF`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Min. Order: ₹{coupon.minOrderValue || 0} {coupon.maxDiscount ? `| Max Discount: ₹${coupon.maxDiscount}` : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          Validity: {validFromFormatted} - {validTillFormatted}
                        </p>
                        {coupon.usageLimit && (
                          <p className="text-xs text-slate-500">
                            Limit: {coupon.usedCount || 0} / {coupon.usageLimit} total uses (Max {coupon.perUserLimit || 1} per user)
                          </p>
                        )}
                        {coupon.description && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-2 border border-slate-100 italic">
                            "{coupon.description}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100 transition-colors border border-red-200"
                        title="Edit Coupon"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon)}
                        className="rounded-lg bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200"
                        title="Delete Coupon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetModal}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[95vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl pb-10"
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingCoupon ? "Edit Coupon Details" : "Create New Coupon"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Enter details below. Edits are sent to the admin for re-approval.
                  </p>
                </div>
                <button onClick={resetModal} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Coupon Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="E.g. SUMMER50, WELCOME20"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 font-bold tracking-wider"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Discount Type</label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, discountType: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Flat (₹)</option>
                      <option value="free_delivery">Free Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Coupon Strategy</label>
                    <select
                      value={formData.couponType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, couponType: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 bg-white"
                    >
                      <option value="generic">Generic Discount</option>
                      <option value="bulk_order">Bulk Order Discount</option>
                      <option value="min_order_value">Minimum Order Value Coupon</option>
                      <option value="free_delivery">Free Delivery Coupon</option>
                      <option value="category_based">Category-Based Coupon</option>
                      <option value="monthly_volume">Monthly Volume Coupon</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Discount Value</label>
                    <input
                      type="number"
                      value={formData.discountValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, discountValue: e.target.value }))}
                      placeholder={formData.discountType === "percentage" ? "15 for 15%" : "100 for ₹100"}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Min. Order Value (₹)</label>
                    <input
                      type="number"
                      value={formData.minOrderValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, minOrderValue: e.target.value }))}
                      placeholder="E.g. 299"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Max Discount (₹) {formData.discountType === "fixed" && "(Ignored for Fixed)"}</label>
                    <input
                      type="number"
                      value={formData.maxDiscount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, maxDiscount: e.target.value }))}
                      placeholder="E.g. 150"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Total Usage Limit</label>
                    <input
                      type="number"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, usageLimit: e.target.value }))}
                      placeholder="E.g. 50 (Total users)"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Per User Limit</label>
                    <input
                      type="number"
                      value={formData.perUserLimit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, perUserLimit: e.target.value }))}
                      placeholder="E.g. 1"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Valid From</label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData((prev) => ({ ...prev, validFrom: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Valid Till</label>
                    <input
                      type="date"
                      value={formData.validTill}
                      onChange={(e) => setFormData((prev) => ({ ...prev, validTill: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="E.g. Get 15% off on your favorite groceries up to ₹150"
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={resetModal} className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSaveCoupon}
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 py-3 font-semibold text-white shadow-lg shadow-red-600/10 transition-colors"
                >
                  {editingCoupon ? "Save Changes" : "Submit Coupon"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
