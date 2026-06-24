import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  FileBadge2,
  Loader2,
  MapPin,
  ShieldCheck,
  Store,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { onboardingFeeAPI } from "../../../services/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import MapPicker from "@shared/components/MapPicker";

const businessTypes = [
  "Quick Commerce",
  "Pharmacy",
];

const initialState = {
  name: "",
  shopName: "",
  email: "",
  phone: "",
  zoneId: "",
  zoneSource: "",
  address: "",
  lat: "",
  lng: "",
  businessType: "",
  alternatePhone: "",
  supportEmail: "",
  openingHours: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  accountType: "",
  upiId: "",
  panNumber: "",
  gstRegistered: false,
  gstNumber: "",
  gstLegalName: "",
  fssaiNumber: "",
  fssaiExpiry: "",
  medicalLicenseNumber: "",
  medicalLicenseExpiry: "",
  shopLicenseNumber: "",
  shopLicenseExpiry: "",
};

const parseOpeningHours = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { openingTime: "", closingTime: "" };
  }

  const match = raw.match(/(\d{1,2}:\d{2})(?::\d{2})?\s*(?:-|to)\s*(\d{1,2}:\d{2})(?::\d{2})?/i);
  if (match) {
    return {
      openingTime: match[1].padStart(5, "0"),
      closingTime: match[2].padStart(5, "0"),
    };
  }

  return { openingTime: "", closingTime: "" };
};

const buildOpeningHoursLabel = (openingTime, closingTime) => {
  if (!openingTime || !closingTime) return "";
  return `${openingTime} - ${closingTime}`;
};
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

const normalizeTimeValue = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const getSellerPhone = (seller = {}) => seller.phone || "";


export default function SellerOnboarding() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [form, setForm] = useState(initialState);
  const [qrFile, setQrFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoursDraft, setHoursDraft] = useState({ openingTime: "", closingTime: "" });
  const [feeConfig, setFeeConfig] = useState(undefined);
  const [fetchingFees, setFetchingFees] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [isReonboardBypass, setIsReonboardBypass] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [medicalLicenseFile, setMedicalLicenseFile] = useState(null);
  const [fssaiFile, setFssaiFile] = useState(null);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setFetchingFees(true);
        const res = await onboardingFeeAPI.getPublicFees();
        const fees = res?.data?.data || res?.data;
        if (fees && fees.SELLER) {
          setFeeConfig(fees.SELLER);
        }
      } catch (err) {
        console.error("Failed to fetch public onboarding fee for seller:", err);
      } finally {
        setFetchingFees(false);
      }
    };
    fetchFees();
  }, []);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({ ...initialState, phone: getSellerPhone(user) || prev.phone }));
      setHoursDraft({ openingTime: "", closingTime: "" });
    }
  }, [user]);

  useEffect(() => {
    const loadProfile = async () => {
      const sellerToken = localStorage.getItem("auth_seller");
      if (!sellerToken) {
        setIsLoading(false);
        navigate("/seller/auth", { replace: true });
        return;
      }

      try {
        const response = await sellerApi.getProfile();
        const data = response?.data?.result || {};
        
        if (sessionStorage.getItem("sellerReonboard") === "true") {
          setForm((prev) => ({ ...initialState, phone: getSellerPhone(data) || prev.phone }));
          setHoursDraft({ openingTime: "", closingTime: "" });
          setRejectionReason(data.approvalNotes || data.rejectionReason || "Your previous application was rejected. Please update your details.");
          setIsReonboardBypass(true); // bypass payment for re-applying
        } else {
          setForm((prev) => ({ ...initialState, phone: getSellerPhone(data) || prev.phone }));
          setHoursDraft(parseOpeningHours(data?.shopInfo?.openingHours || data?.openingHours || ""));

          // If rejected, show reason and bypass onboarding fee
          if (data?.approvalStatus === "rejected") {
            setRejectionReason(data.approvalNotes || data.rejectionReason || "Your previous application was rejected. Please update your details.");
            setIsReonboardBypass(true); // bypass payment for re-applying
          } else if (data?.approvalStatus === "pending_approval" || data?.approvalStatus === "approved" || data?.onboardingSubmitted) {
            setIsReonboardBypass(true); // bypass payment if already registered
          }
        }
      } catch (error) {
        if (error?.response?.status !== 401) {
          toast.error("Failed to load seller onboarding data");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const loadZones = async () => {
      try {
        setZonesLoading(true);
        const quickResponse = await sellerApi.getQuickZonesPublic();
        const quickZones = Array.isArray(quickResponse?.data?.result?.zones)
          ? quickResponse.data.result.zones
          : Array.isArray(quickResponse?.data?.data?.zones)
            ? quickResponse.data.data.zones
            : [];

        setZones(
          quickZones.map((zone) => ({
            ...zone,
            source: "quick",
            label: zone?.name || zone?.zoneName || zone?.serviceLocation || "Quick Zone",
          })),
        );
      } catch (error) {
        toast.error("Failed to load service zones");
        setZones([]);
      } finally {
        setZonesLoading(false);
      }
    };

    loadZones();
  }, []);

  const completionText = useMemo(() => {
    const fields = [
      form.name,
      form.shopName,
      form.email,
      form.address,
      form.businessType,
      form.accountNumber,
      form.ifscCode,
      form.upiId,
      form.shopLicenseNumber,
    ];
    const done = fields.filter(Boolean).length;
    return `${done}/9 core fields filled`;
  }, [form]);

  const initialLocation = useMemo(
    () => (form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null),
    [form.lat, form.lng],
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const { openingTime, closingTime } = useMemo(
    () => parseOpeningHours(form.openingHours),
    [form.openingHours],
  );


  const selectedZone = useMemo(
    () =>
      zones.find(
        (zone) =>
          String(zone?._id || zone?.id || "") === String(form.zoneId || "") &&
          String(zone?.source || "") === String(form.zoneSource || ""),
      ) || null,
    [form.zoneId, form.zoneSource, zones],
  );

  const handleOpeningHoursChange = (key, value) => {
    const normalizedValue = normalizeTimeValue(value);
    setHoursDraft((prev) => ({
      ...prev,
      [key]: normalizedValue,
    }));
  };

  const handleSaveOpeningHours = async () => {
    if (!hoursDraft.openingTime || !hoursDraft.closingTime) {
      toast.error("Select both opening and closing time first");
      return;
    }

    const openingHoursLabel = buildOpeningHoursLabel(
      hoursDraft.openingTime,
      hoursDraft.closingTime,
    );

    setIsSavingHours(true);
    try {
      updateField("openingHours", openingHoursLabel);
      await sellerApi.updateProfile({
        openingHours: openingHoursLabel,
      });
      toast.success("Opening hours saved");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to save opening hours",
      );
    } finally {
      setIsSavingHours(false);
    }
  };

  const openingHoursPreview =
    buildOpeningHoursLabel(hoursDraft.openingTime, hoursDraft.closingTime) ||
    form.openingHours ||
    "Not set";

  const handleLocationSelect = (location) => {
    setForm((prev) => ({
      ...prev,
      lat: Number.isFinite(location?.lat) ? Number(location.lat.toFixed(6)) : prev.lat,
      lng: Number.isFinite(location?.lng) ? Number(location.lng.toFixed(6)) : prev.lng,
      address: location?.address || prev.address,
    }));
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!form.businessType) {
        toast.error("Please select a business type first");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!form.name || !form.shopName || !form.email || !form.address) {
        toast.error("Fill seller name, shop name, email, and address first");
        return;
      }
      if (form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
        toast.error("Enter a valid email address");
        return;
      }
      if (form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail)) {
        toast.error("Enter a valid support email address");
        return;
      }
      if (!form.zoneId) {
        toast.error("Please select a service zone");
        return;
      }
      if (!form.lat || !form.lng) {
        toast.error("Please pin your store location on the map");
        return;
      }
      if (form.alternatePhone && form.alternatePhone === form.phone) {
        toast.error("Alternate phone cannot be same as primary");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber)) {
        toast.error("Invalid PAN format");
        return;
      }
      if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber)) {
        toast.error("Invalid GST format");
        return;
      }
      if (form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber)) {
        toast.error("Invalid shop license number");
        return;
      }
      if (form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0]) {
        toast.error("Shop license expiry cannot be a past date");
        return;
      }
      if (form.businessType === "Pharmacy") {
        if (!form.medicalLicenseNumber || form.medicalLicenseNumber.trim() === "") {
          toast.error("Medical License Number is required for Pharmacy");
          return;
        }
        if (form.medicalLicenseNumber && !/^[A-Za-z0-9\/\-\s]{5,20}$/.test(form.medicalLicenseNumber)) {
          toast.error("Medical License Number must be 5-20 characters (letters, numbers, /, - only)");
          return;
        }
        if (!form.medicalLicenseExpiry) {
          toast.error("Medical License Expiry Date is required for Pharmacy");
          return;
        }
        if (form.medicalLicenseExpiry < new Date().toISOString().split("T")[0]) {
          toast.error("Medical License expiry cannot be a past date");
          return;
        }
        if (!medicalLicenseFile && !form.medicalLicenseImage) {
          toast.error("Medical License Image is required for Pharmacy");
          return;
        }
      } else {
        if (form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0]) {
          toast.error("FSSAI expiry cannot be a past date");
          return;
        }
        if (form.fssaiNumber && !/^\d{14}$/.test(form.fssaiNumber)) {
          toast.error("FSSAI number must be exactly 14 digits");
          return;
        }
        if (!fssaiFile && !form.fssaiImage) {
          toast.error("FSSAI Image is required");
          return;
        }
      }
      setCurrentStep(4);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep !== 4) {
      handleNextStep();
      return;
    }

    if (form.accountNumber && !/^\d{6,20}$/.test(form.accountNumber)) {
      toast.error("Account number must be 6–20 digits");
      return;
    }
    if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      toast.error("Invalid IFSC code");
      return;
    }
    if (form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId)) {
      toast.error("Invalid UPI ID");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      const nextForm = {
        ...form,
        zoneName: selectedZone?.label || "",
      };
      Object.entries(nextForm).forEach(([key, value]) => {
        if (key === "radius") return;
        payload.append(
          key,
          typeof value === "boolean" ? String(value) : String(value ?? ""),
        );
      });
      payload.append("submitForApproval", "true");
      if (qrFile) payload.append("upiQrImage", qrFile);
      if (licenseFile) payload.append("shopLicenseImage", licenseFile);
      if (medicalLicenseFile) payload.append("medicalLicenseImage", medicalLicenseFile);
      if (fssaiFile) payload.append("fssaiImage", fssaiFile);

      if (feeConfig && !isReonboardBypass && feeConfig.isActive && feeConfig.price > 0) {
        const orderRes = await onboardingFeeAPI.createOrder({
          role: "SELLER",
          name: form.name || form.shopName,
          phone: form.phone || form.alternatePhone,
          email: form.email || ""
        });
        const orderData = orderRes?.data?.data || orderRes?.data;
        
        if (!orderData || !orderData.orderId) {
          throw new Error("Failed to create onboarding payment order");
        }

        if (orderData.isMock || orderData.orderId.startsWith("mock_ord_")) {
          toast.success("Developer Mode: Payment bypassed. Submitting mock payment details.");
          payload.append("razorpayOrderId", orderData.orderId);
          payload.append("razorpayPaymentId", `mock_pay_${Date.now()}`);
          payload.append("razorpaySignature", `mock_sig_${Date.now()}`);
          
          await sellerApi.updateProfile(payload);
          await refreshUser();
          sessionStorage.removeItem("sellerReonboard");
          toast.success("Application submitted for admin approval");
          navigate("/seller/pending", { replace: true });
        } else {
          // Open real Razorpay modal
          setIsSubmitting(false); // Let interactive flow proceed
          const rzpOptions = {
            key: orderData.keyId,
            amount: Math.round(orderData.amount * 100),
            currency: orderData.currency || "INR",
            order_id: orderData.orderId,
            name: "Onboarding Fee Payment",
            description: `Onboarding fee for ${form.shopName}`,
            prefill: {
              name: form.name || "",
              email: form.email || "",
              contact: form.phone || ""
            },
            handler: async (response) => {
              try {
                setIsSubmitting(true);
                payload.append("razorpayOrderId", response.razorpay_order_id);
                payload.append("razorpayPaymentId", response.razorpay_payment_id);
                payload.append("razorpaySignature", response.razorpay_signature);

                await sellerApi.updateProfile(payload);
                await refreshUser();
                sessionStorage.removeItem("sellerReonboard");
                toast.success("Application submitted for admin approval");
                navigate("/seller/pending", { replace: true });
              } catch (error) {
                toast.error(error?.response?.data?.message || "Failed to submit onboarding");
              } finally {
                setIsSubmitting(false);
              }
            },
            onError: (err) => {
              toast.error(err?.description || "Payment failed. Please try again.");
              setIsSubmitting(false);
            },
            onClose: () => {
              toast.error("Payment modal closed. Payment is required to complete onboarding.");
              setIsSubmitting(false);
            }
          };
          await initRazorpayPayment(rzpOptions);
        }
      } else {
        await sellerApi.updateProfile(payload);
        await refreshUser();
        sessionStorage.removeItem("sellerReonboard");
        toast.success("Application submitted for admin approval");
        navigate("/seller/pending", { replace: true });
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to submit onboarding",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#fffaf2_100%)] px-4 py-8 font-['Outfit'] md:px-8 seller-theme-scope">
      <div className="mx-auto max-w-7xl">
        {rejectionReason && (
          <div className="mb-6 rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 shadow-sm">
            <div className="mt-0.5 shrink-0 rounded-full bg-red-100 p-2 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86C20.47 19 21.5 17.56 20.79 16.13L13.93 3.93a2 2 0 00-3.86 0L2.21 16.13C1.5 17.56 2.53 19 4.07 19z" /></svg>
            </div>
            <div>
              <p className="text-sm font-black text-red-800">Previous Application Rejected</p>
              <p className="mt-1 text-sm font-medium text-red-700">{rejectionReason}</p>
              <p className="mt-2 text-xs font-semibold text-red-500">Please update your details below and resubmit. No payment will be charged for re-applying.</p>
            </div>
          </div>
        )}
        <div className="grid gap-8 lg:grid-cols-[1.05fr_1.4fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[34px] bg-red-500 p-5 md:p-8 text-white shadow-[0_35px_90px_rgba(234,88,12,0.22)]"
          >
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">
                <ShieldCheck className="h-4 w-4" />
                Seller Onboarding
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] cursor-pointer"
              >
                Logout
              </button>
            </div>
            <h1 className="mt-8 text-3xl md:text-4xl font-black leading-tight">
              Set up your store once and send it straight for approval.
            </h1>
            <p className="mt-4 max-w-lg text-sm font-medium leading-7 text-white/78">
              We&apos;ll save your banking, compliance, and shop details together,
              then raise a real joining request in quick-commerce admin.
            </p>

            <div className="mt-10 space-y-4">
              {[
                {
                  icon: Store,
                  title: "Store Identity",
                  text: "Owner, shop, location, and operational details.",
                },
                {
                  icon: CreditCard,
                  title: "Bank & UPI",
                  text: "Settlement-ready bank account and QR image.",
                },
                {
                  icon: FileBadge2,
                  title: "Compliance",
                  text: `PAN, GST, ${form.businessType === "Pharmacy" ? "Medical License" : "FSSAI"}, and shop license details.`,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/12 bg-white/10 p-5 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-white/12 p-3">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black">{item.title}</p>
                      <p className="mt-1 text-xs font-medium leading-6 text-white/72">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-white/12 bg-white/10 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/60">
                Progress Signal
              </p>
              <p className="mt-2 text-2xl font-black">{completionText}</p>
              <p className="mt-2 text-xs font-semibold text-white/70">
                Add the missing core details and submit. Admin will see the
                request inside quick-commerce.
              </p>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-6 rounded-[34px] border border-white/70 bg-white/90 p-5 md:p-6 shadow-[0_35px_90px_rgba(15,23,42,0.08)] backdrop-blur xl:p-8 w-full max-w-full overflow-hidden"
          >
            <div className="mb-8 flex items-center justify-between">
              {[1, 2, 3, 4].map((stepNumber) => (
                <div key={stepNumber} className="flex flex-col items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${currentStep >= stepNumber ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {stepNumber}
                  </div>
                  <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {stepNumber === 1 ? "Business" : stepNumber === 2 ? "Store" : stepNumber === 3 ? "Documents" : "Bank"}
                  </span>
                </div>
              ))}
            </div>

            {currentStep === 1 && (
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-red-100 p-3 text-red-500">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Business Profile
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    Select your business category to begin.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-900">Business type <span className="text-red-500">*</span></label>
                  <select required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" value={form.businessType} onChange={(e) => updateField("businessType", e.target.value)}>
                    <option value="">Select business type</option>
                    {businessTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
            )}

            {currentStep === 2 && (
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-red-100 p-3 text-red-500">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Store details
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    How your seller account will appear to admin and customers.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Seller name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Seller name" value={form.name} onChange={(e) => updateField("name", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Shop name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Shop name" value={form.shopName} onChange={(e) => updateField("shopName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Email <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Email (e.g. name@domain.com)"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                  {form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Enter a valid email address (e.g. name@domain.com)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Primary phone <span className="text-red-500">*</span></label>
                  <input className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-semibold text-slate-500 outline-none" placeholder="Primary phone" value={form.phone} readOnly title="Linked from the seller OTP login" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Alternate phone <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.alternatePhone && form.alternatePhone === form.phone ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Alternate phone"
                    value={form.alternatePhone}
                    onChange={(e) => updateField("alternatePhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                  {form.alternatePhone && form.alternatePhone === form.phone && (
                    <p className="text-xs font-semibold text-red-500 px-1">Alternate number cannot be same as primary number</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Service zone <span className="text-red-500">*</span></label>
                <select
                  required
                  className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900"
                  value={`${form.zoneSource}:${form.zoneId}`}
                  onChange={(e) => {
                    const [zoneSource, zoneId] = e.target.value.split(":");
                    setForm((prev) => ({
                      ...prev,
                      zoneSource: zoneSource || "",
                      zoneId: zoneId || "",
                    }));
                  }}
                  disabled={zonesLoading}
                >
                  <option value=":">
                    {zonesLoading ? "Loading zones..." : "Select a service zone"}
                  </option>
                  {zones.map((zone) => {
                    const zoneId = String(zone?._id || zone?.id || "");
                    const zoneSource = String(zone?.source || "");
                    return (
                      <option key={`${zoneSource}-${zoneId}`} value={`${zoneSource}:${zoneId}`}>
                        {zone.label}
                      </option>
                    );
                  })}
                </select>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-900">Support email <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Support email (e.g. support@example.com)"
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => updateField("supportEmail", e.target.value)}
                  />
                  {form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Enter a valid email address (e.g. support@example.com)</p>
                  )}
                </div>
                {selectedZone ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 md:col-span-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600">Selected zone</p>
                    <p className="mt-1 text-sm font-semibold text-red-900">
                      {selectedZone.label}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Opening hours</p>
                      <p className="text-xs font-medium text-slate-500">Select your daily opening and closing time.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {openingHoursPreview}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Opens at</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-900"
                        value={hoursDraft.openingTime}
                        onChange={(e) => handleOpeningHoursChange("openingTime", e.target.value)}
                      >
                        <option value="">Select opening time</option>
                        {timeOptions.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Closes at</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-900"
                        value={hoursDraft.closingTime}
                        onChange={(e) => handleOpeningHoursChange("closingTime", e.target.value)}
                      >
                        <option value="">Select closing time</option>
                        {timeOptions.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveOpeningHours}
                      disabled={isSavingHours}
                      className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {isSavingHours ? "Saving..." : "Save Hours"}
                    </button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">Store location</p>
                      <p className="text-xs font-medium text-slate-500">Pin your storefront on the map so deliveries route correctly.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-red-600"
                    >
                      <MapPin className="h-4 w-4" />
                      {form.lat && form.lng ? "Change Pin" : "Pick On Map"}
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Selected address</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                        {form.address || "Choose your store location on the map to auto-fill the address."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Latitude</p>
                      <p className="mt-1 font-semibold text-slate-700">{(form.lat !== null && form.lat !== "") ? form.lat : "Not selected"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Longitude</p>
                      <p className="mt-1 font-semibold text-slate-700">{(form.lng !== null && form.lng !== "") ? form.lng : "Not selected"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            )}

            {currentStep === 4 && (
            <section className="space-y-5 rounded-[28px] bg-slate-50/80 p-5">
              <h2 className="text-lg font-black text-slate-900">
                Banking and UPI
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Bank name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Bank name" value={form.bankName} onChange={(e) => updateField("bankName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Account holder name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Account holder name" value={form.accountHolderName} onChange={(e) => updateField("accountHolderName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Account number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.accountNumber && !/^\d{6,20}$/.test(form.accountNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Account number (6–20 digits)"
                    value={form.accountNumber}
                    maxLength={20}
                    onChange={(e) => updateField("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 20))}
                  />
                  {form.accountNumber && !/^\d{6,20}$/.test(form.accountNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Account number must be 6–20 digits (numbers only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">IFSC code <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold uppercase outline-none focus:border-slate-900 ${form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="IFSC code (e.g. ABCD0EF1234)"
                    value={form.ifscCode}
                    maxLength={11}
                    onChange={(e) => updateField("ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                  />
                  {form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid IFSC: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Account type <span className="text-red-500">*</span></label>
                <select
                  required
                  className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900"
                  value={form.accountType}
                  onChange={(e) => updateField("accountType", e.target.value)}
                >
                  <option value="">Select account type</option>
                  <option value="Savings">Savings Account</option>
                  <option value="Current">Current Account</option>
                  <option value="Salary">Salary Account</option>
                  <option value="Fixed Deposit">Fixed Deposit Account</option>
                  <option value="Recurring Deposit">Recurring Deposit Account</option>
                  <option value="NRI">NRI Account (NRE/NRO)</option>
                  <option value="Jan Dhan">Jan Dhan Account</option>
                  <option value="BSBDA">Basic Savings Bank Deposit (BSBDA)</option>
                </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">UPI ID <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="UPI ID (e.g. name@okhdfcbank)"
                    value={form.upiId}
                    onChange={(e) => updateField("upiId", e.target.value)}
                  />
                  {form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-900">UPI QR image <span className="text-red-500">*</span></label>
                  <label className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                    <span className="truncate max-w-[200px]">{qrFile?.name || "Upload UPI QR image"}</span>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                      <Upload className="h-3.5 w-3.5" />
                      Choose
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setQrFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            </section>
            )}

            {currentStep === 3 && (
            <section className="space-y-5">
              <h2 className="text-lg font-black text-slate-900">
                Compliance and license
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">PAN number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold uppercase outline-none focus:border-slate-900 ${form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="PAN number (e.g. ABCDE1234F)"
                    value={form.panNumber}
                    maxLength={10}
                    onChange={(e) => updateField("panNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                  />
                  {form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)</p>
                  )}
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700">
                  <input type="checkbox" checked={form.gstRegistered} onChange={(e) => updateField("gstRegistered", e.target.checked)} />
                  GST registered
                </label>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">GST number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold uppercase outline-none focus:border-slate-900 ${form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="GST number (e.g. 22ABCDE1234F1Z5)"
                    value={form.gstNumber}
                    maxLength={15}
                    onChange={(e) => updateField("gstNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
                  />
                  {form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid GST format. Must be 15 chars: 2 digits + PAN (10) + entity + Z + check (e.g. 22ABCDE1234F1Z5)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">GST legal name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="GST legal name" value={form.gstLegalName} onChange={(e) => updateField("gstLegalName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                {form.businessType !== "Pharmacy" ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-900">FSSAI number <span className="text-red-500">*</span></label>
                      <input
                        required={form.businessType !== "Pharmacy"}
                        className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.fssaiNumber && !/^\d{14}$/.test(form.fssaiNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                        placeholder="FSSAI number (14 digits)"
                        value={form.fssaiNumber}
                        maxLength={14}
                        onChange={(e) => updateField("fssaiNumber", e.target.value.replace(/\D/g, "").slice(0, 14))}
                      />
                      {form.fssaiNumber && !/^\d{14}$/.test(form.fssaiNumber) && (
                        <p className="text-xs font-semibold text-red-500 px-1">FSSAI number must be exactly 14 digits (numbers only)</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-900">FSSAI expiry date <span className="text-red-500">*</span></label>
                      <input
                        required={form.businessType !== "Pharmacy"}
                        className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                        type="date"
                        value={form.fssaiExpiry}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => updateField("fssaiExpiry", e.target.value)}
                      />
                      {form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0] && (
                        <p className="text-xs font-semibold text-red-500 px-1">FSSAI expiry date cannot be a past date</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-900">FSSAI Image <span className="text-red-500">*</span></label>
                      <label className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                        <span className="truncate max-w-[200px]">{fssaiFile?.name || "Upload FSSAI image"}</span>
                        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                          <Upload className="h-3.5 w-3.5" />
                          Choose
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setFssaiFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-900">Medical License Number <span className="text-red-500">*</span></label>
                      <input
                        required={form.businessType === "Pharmacy"}
                        className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.medicalLicenseNumber && !/^[A-Za-z0-9\/\-\s]{5,20}$/.test(form.medicalLicenseNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                        placeholder="Medical License Number"
                        value={form.medicalLicenseNumber}
                        maxLength={20}
                        onChange={(e) => updateField("medicalLicenseNumber", e.target.value.replace(/[^A-Za-z0-9\/\-\s]/g, "").slice(0, 20))}
                      />
                      {form.medicalLicenseNumber && !/^[A-Za-z0-9\/\-\s]{5,20}$/.test(form.medicalLicenseNumber) && (
                        <p className="text-xs font-semibold text-red-500 px-1">License number must be 5–20 characters</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-900">Medical License Expiry <span className="text-red-500">*</span></label>
                      <input
                        required={form.businessType === "Pharmacy"}
                        className={`rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900`}
                        type="date"
                        value={form.medicalLicenseExpiry}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => updateField("medicalLicenseExpiry", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-900">Medical License Image <span className="text-red-500">*</span></label>
                      <label className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                        <span className="truncate max-w-[200px]">{medicalLicenseFile?.name || "Upload medical license image"}</span>
                        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                          <Upload className="h-3.5 w-3.5" />
                          Choose
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setMedicalLicenseFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Shop license number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Shop license number (e.g. MH/2023/12345)"
                    value={form.shopLicenseNumber}
                    maxLength={20}
                    onChange={(e) => updateField("shopLicenseNumber", e.target.value.replace(/[^A-Za-z0-9\/\-]/g, "").slice(0, 20))}
                  />
                  {form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">License number must be 5–20 characters (letters, numbers, / and - only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-900">Shop license expiry date <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    type="date"
                    value={form.shopLicenseExpiry}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => updateField("shopLicenseExpiry", e.target.value)}
                  />
                  {form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0] && (
                    <p className="text-xs font-semibold text-red-500 px-1">Shop license expiry date cannot be a past date</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-900">Shop license image <span className="text-red-500">*</span></label>
                  <label className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                    <span className="truncate max-w-[200px]">{licenseFile?.name || "Upload shop license image"}</span>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                      <Upload className="h-3.5 w-3.5" />
                      Choose
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setLicenseFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            </section>
            )}


            {currentStep === 4 && feeConfig && !isReonboardBypass && feeConfig.isActive && feeConfig.price > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5 mt-4 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-red-600">
                  Required Onboarding Fee
                </p>
                <p className="mt-2 text-2xl font-black text-red-900">₹{feeConfig.price}</p>
                <p className="mt-2 text-xs font-semibold text-red-700">
                  An onboarding fee is required to submit your seller registration.
                  You will be prompted to make a secure payment via Razorpay.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 md:flex-row md:items-center md:justify-between">
              <p className="max-w-xl text-sm font-medium leading-6 text-slate-500">
                {currentStep === 4 ? "When you submit, the seller request will move into admin review." : "Please fill out all the details carefully before proceeding."}
              </p>
              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-200 px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-600 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Submitting..." : currentStep === 4 ? "Submit for approval" : "Next"}
                  {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </motion.form>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={initialLocation}
          zoneCoordinates={selectedZone?.coordinates || []}
          zoneLabel={selectedZone?.label || ""}
        />
      )}
    </div>
  );
}



