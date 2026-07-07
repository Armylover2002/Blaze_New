import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Package,
  X,
  IndianRupee,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { uploadAPI } from "@food/api";
import { openCamera } from "@food/utils/imageUploadUtils";
import { ActionSlider } from "@/modules/DeliveryV2/components/ui/ActionSlider";
import porterDriverApi from "@/modules/porter/driver/services/driverApi";

const PAID_STATUSES = ["paid", "captured", "authorized"];

export default function PorterDeliveryVerificationModal({ order, onComplete, onClose }) {
  const [isUploading, setIsUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraInputRef = useRef(null);

  // Payment (COD) state — mirrors the Food delivery payment popup.
  const [paymentMode, setPaymentMode] = useState(null); // 'cash' | 'qr'
  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle | pending | paid
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [collectQrLink, setCollectQrLink] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const pollingRef = useRef(null);

  const orderId = order?.orderId || order?.orderMongoId || order?.id || order?._id;
  const receiverName = order?.receiverName || order?.parcel?.receiverName || "Receiver";
  const deliveryAddress = order?.dropAddress || order?.delivery?.address || "Delivery address";
  const amountToCollect =
    Number(order?.pricing?.total) || Number(order?.payment?.amountDue) || Number(order?.amountToCollect) || 0;

  const paymentMethod = String(
    order?.paymentMethod || order?.payment?.method || "wallet",
  ).toLowerCase();
  const isPrepaid = PAID_STATUSES.includes(String(order?.payment?.status || "").toLowerCase());
  const isCod = paymentMethod === "cash" && !isPrepaid;
  const isPaid = paymentStatus === "paid";

  const handlePhotoSelect = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }
    setIsUploading(true);
    try {
      const res = await uploadAPI.uploadMedia(file, { folder: "appzeto/delivery/parcel-delivery" });
      if (res?.data?.success && res?.data?.data) {
        setPhotoUrl(res.data.data.url || res.data.data.secure_url);
        setPhotoUploaded(true);
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      toast.error("Failed to upload delivery photo");
      setPhotoUploaded(false);
      setPhotoUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const checkPaymentSync = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await porterDriverApi.getPaymentStatus(orderId);
      const status = String(data?.payment?.status || "").toLowerCase();
      if (PAID_STATUSES.includes(status)) {
        setPaymentStatus("paid");
        setShowQrModal(false);
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch { /* ignore poll errors */ }
  }, [orderId]);

  useEffect(() => {
    if (paymentMode === "qr" && paymentStatus === "pending") {
      pollingRef.current = setInterval(checkPaymentSync, 5000);
    }
    return () => clearInterval(pollingRef.current);
  }, [paymentMode, paymentStatus, checkPaymentSync]);

  const generateQr = async () => {
    setIsGeneratingQr(true);
    setPaymentMode("qr");
    try {
      const data = await porterDriverApi.createCollectQr(orderId, {
        name: receiverName,
        phone: order?.receiverPhone || order?.userPhone || "",
      });
      const link = data?.shortUrl || data?.imageUrl || null;
      if (link) {
        setCollectQrLink(link);
        setPaymentStatus("pending");
        setShowQrModal(true);
      } else {
        toast.error("Could not generate QR code");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "QR generation failed");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleManualCheck = async () => {
    setIsSyncing(true);
    await checkPaymentSync();
    setTimeout(() => setIsSyncing(false), 800);
  };

  const paymentResolved = !isCod || isPaid || paymentMode === "cash";

  const handleComplete = async () => {
    if (!photoUrl) {
      toast.error("Please upload parcel delivery photo");
      return;
    }
    if (isCod && !paymentResolved) {
      toast.error("Collect payment first");
      return;
    }
    setIsSubmitting(true);
    try {
      await onComplete(photoUrl);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to complete delivery");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sliderDisabled = !photoUploaded || isSubmitting || (isCod && !paymentResolved);
  const lockedLabel = isCod && !paymentResolved
    ? "Collect payment to unlock"
    : "Upload delivery photo to unlock";

  return (
    <>
      <div className="absolute inset-x-0 bottom-0 z-[120] flex items-end justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/40 -z-10"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          className="w-full max-w-lg rounded-t-[2rem] bg-white p-5 pb-8 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF0000]">Parcel delivery</p>
              <h3 className="text-lg font-extrabold text-gray-950">Complete handover</h3>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F1] text-[#FF0000]">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Receiver</p>
                <p className="text-[15px] font-bold text-gray-900">{receiverName}</p>
                <p className="mt-1 text-[12px] text-gray-600">{deliveryAddress}</p>
              </div>
            </div>
          </div>

          {/* COD payment panel — same options as Food (QR / Cash in Hand) */}
          {isCod && (
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                    {isPaid ? "Amount Paid Online" : "Cash to Collect"}
                  </p>
                  <p className="text-3xl font-bold text-amber-950">₹{amountToCollect.toFixed(2)}</p>
                </div>
                {isPaid && (
                  <span className="rounded-full bg-green-500 px-3 py-1.5 text-[10px] font-bold text-white">PAID ✓</span>
                )}
              </div>

              {!isPaid && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={generateQr}
                    disabled={isGeneratingQr}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-bold uppercase tracking-widest transition-all ${
                      paymentMode === "qr"
                        ? "bg-amber-600 text-white shadow-lg ring-2 ring-amber-300 ring-offset-2"
                        : "border-2 border-amber-200 bg-white text-amber-800"
                    }`}
                  >
                    {isGeneratingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-5 w-5" />}
                    Customer pays by QR / UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("cash")}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-bold uppercase tracking-widest transition-all ${
                      paymentMode === "cash"
                        ? "bg-amber-600 text-white shadow-lg ring-2 ring-amber-300 ring-offset-2"
                        : "border-2 border-amber-200 bg-white text-amber-800"
                    }`}
                  >
                    <IndianRupee className="h-5 w-5" />
                    Cash in Hand
                  </button>
                </div>
              )}

              {paymentMode === "cash" && !isPaid && (
                <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  Confirm cash received ₹{amountToCollect.toFixed(2)}
                </p>
              )}
            </div>
          )}

          <div className="mb-4 rounded-2xl border border-[#10B981]/20 bg-[#10B981]/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">Parcel delivery photo</p>
            <p className="mt-1 text-sm font-semibold text-gray-700">Capture proof of parcel handover at destination</p>

            <div className="mt-4 flex gap-3">
              {!photoUploaded && !isUploading && (
                <>
                  <button
                    type="button"
                    onClick={() => openCamera({
                      onSelectFile: handlePhotoSelect,
                      fileNamePrefix: `parcel-delivery-${orderId || "order"}`,
                    })}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 text-xs font-bold uppercase tracking-widest text-white"
                  >
                    <Camera className="h-5 w-5" />
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 py-4 text-xs font-bold uppercase tracking-widest text-red-600"
                  >
                    <ImageIcon className="h-5 w-5" />
                    Gallery
                  </button>
                </>
              )}
              {isUploading && (
                <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              )}
              {photoUploaded && (
                <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-100 py-4 text-xs font-bold uppercase tracking-widest text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Photo uploaded
                </div>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
                className="hidden"
              />
            </div>
          </div>

          <p className={`mb-3 text-center text-[9px] font-bold uppercase tracking-widest ${!sliderDisabled ? "text-green-600" : "text-gray-400"}`}>
            {!sliderDisabled ? "Swipe to complete delivery" : lockedLabel}
          </p>
          <ActionSlider
            label="Slide to Complete Delivery"
            lockedLabel={lockedLabel}
            successLabel="Delivered!"
            disabled={sliderDisabled}
            onConfirm={handleComplete}
            color="bg-[#FF0000]"
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="flex w-full max-w-sm flex-col items-center rounded-3xl bg-white p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-xl font-bold text-gray-950">Scan to Pay</h3>
              <p className="mb-8 text-sm font-medium text-gray-500">Order Total: ₹{amountToCollect.toFixed(2)}</p>
              <div className="relative mb-8 rounded-3xl border-2 border-gray-100 bg-gray-50 p-6">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(collectQrLink || "")}`}
                  alt="Payment QR"
                  className="h-56 w-56"
                />
                <button
                  onClick={handleManualCheck}
                  disabled={isSyncing}
                  className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-green-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95"
                >
                  {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Check Status
                </button>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full rounded-2xl bg-gray-100 py-4 text-xs font-bold uppercase tracking-widest text-gray-500"
              >
                Close QR
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
