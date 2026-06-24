import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Store,
  Shield,
  Edit2,
  Save,
  X,
  Rocket,
  Globe,
  MapPin,
  CheckCircle,
  Trash2,
  AlertTriangle,
  LogOut,
  Star,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import MapPicker from "../../../shared/components/MapPicker";
import { clearModuleAuth } from "@food/utils/auth";
import { useAuth } from "@core/context/AuthContext";

const SellerProfile = () => {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocationSaving, setIsLocationSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [zones, setZones] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    shopName: '',
    phone: '',
    email: '',
    lat: null,
    lng: null,
    address: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const loadZones = async () => {
      try {
        const response = await sellerApi.getQuickZonesPublic();
        const quickZones = Array.isArray(response?.data?.result?.zones)
          ? response.data.result.zones
          : Array.isArray(response?.data?.data?.zones)
            ? response.data.data.zones
            : [];

        setZones(
          quickZones.map((zone) => ({
            ...zone,
            source: "quick",
            label:
              zone?.name ||
              zone?.zoneName ||
              zone?.serviceLocation ||
              "Quick Zone",
          })),
        );
      } catch {
        setZones([]);
      }
    };

    loadZones();
  }, []);

  const selectedZone = useMemo(() => {
    const zoneId = String(
      profile?.shopInfo?.zoneId?._id ||
        profile?.shopInfo?.zoneId ||
        "",
    );
    const zoneSource = String(profile?.shopInfo?.zoneSource || "");
    const zoneName = String(profile?.shopInfo?.zoneName || "")
      .trim()
      .toLowerCase();

    if (!zoneId && !zoneName) return null;

    return (
      zones.find((zone) => {
        const currentId = String(zone?._id || zone?.id || "");
        const matchesId = zoneId && currentId === zoneId;
        const matchesSource =
          !zoneSource || String(zone?.source || "") === zoneSource;

        if (matchesId && matchesSource) return true;

        if (!zoneName) return false;

        const labels = [
          zone?.name,
          zone?.zoneName,
          zone?.serviceLocation,
          zone?.label,
        ]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean);

        return labels.includes(zoneName);
      }) || null
    );
  }, [profile?.shopInfo?.zoneId, profile?.shopInfo?.zoneSource, profile?.shopInfo?.zoneName, zones]);

  const fetchProfile = async () => {
    const sellerToken = localStorage.getItem("auth_seller");
    if (!sellerToken) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await sellerApi.getProfile();
      const data = response.data.result;
      setProfile(data);
      setFormData({
      name: data.name,
      shopName: data.shopName,
      phone: data.phone,
      email: data.email,
      lat: (data.location?.coordinates && data.location.coordinates[1] !== undefined) ? data.location.coordinates[1] : null,
      lng: (data.location?.coordinates && data.location.coordinates[0] !== undefined) ? data.location.coordinates[0] : null,
      address: data.address || '',
    });
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error("Failed to fetch profile");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const syncLocationProfileState = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      address: location.address || location.formattedAddress || "",
    }));
  };

  const handleLocationSelect = async (location) => {
    const nextLocation = {
      lat: location.lat,
      lng: location.lng,
      address: location.address || location.formattedAddress || "",
    };

    syncLocationProfileState(nextLocation);
    setIsLocationSaving(true);

    try {
      await sellerApi.updateProfile(nextLocation);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              address: nextLocation.address,
              location: {
                ...(prev.location || {}),
                type: "Point",
                coordinates: [nextLocation.lng, nextLocation.lat],
                latitude: nextLocation.lat,
                longitude: nextLocation.lng,
                formattedAddress: nextLocation.address,
                address: nextLocation.address,
              },
            }
          : prev,
      );
      toast.success("Location updated successfully");
      await fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update location");
      fetchProfile();
    } finally {
      setIsLocationSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      // Disallow numbers in seller name
      const cleaned = value.replace(/[0-9]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone") {
      // Allow only digits, max 10 characters
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "email") {
      // Trim spaces, keep as-is otherwise; HTML5 type=email will help validate shape
      setFormData({ ...formData, [name]: value.trimStart() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const initialLocation = useMemo(
    () => (formData.lat ? { lat: formData.lat, lng: formData.lng } : null),
    [formData.lat, formData.lng],
  );

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    const normalizedPhone = String(formData.phone || "")
      .replace(/[^0-9]/g, "")
      .slice(-10);
    const trimmedEmail = String(formData.email || "").trim().toLowerCase();

    // Seller phone is required, but email is optional in the backend model.
    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        phone: normalizedPhone,
        email: trimmedEmail,
        lat: formData.lat,
        lng: formData.lng,
      };
      await sellerApi.updateProfile(payload);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      await fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await sellerApi.deleteAccount();
      clearModuleAuth("seller");
      toast.success("Account deleted successfully");
      window.location.href = "/seller/auth";
    } catch (error) {
      console.error("Error deleting seller account:", error);
      toast.error(error?.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 font-['Outfit']">
      {/* Header Section */}
      <div className="relative mb-24 px-4">
        {/* Banner Background */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-900 h-64 rounded-lg shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="absolute bottom-8 left-12 right-12 flex flex-col md:flex-row items-center md:items-end gap-10">
          {/* Avatar Container */}
          <div className="h-44 w-44 rounded-full bg-white p-2 shadow-[0_30px_70px_rgba(0,0,0,0.15)] flex-shrink-0">
            <div className="h-full w-full rounded-full bg-slate-50 flex items-center justify-center border-4 border-slate-50">
              <span className="text-7xl font-black text-slate-900">
                {profile?.name?.charAt(0)}
              </span>
            </div>
          </div>

          {/* Info Block */}
          <div className="flex-1 pb-4 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-3">
              <span className="px-4 py-1.5 bg-white/10 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-[2px] rounded-full border border-white/20">
                {profile?.role}
              </span>
              <span
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-[2px] rounded-full border ${profile?.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}
                style={{ backdropFilter: "blur(12px)" }}>
                {profile?.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <h1 className="text-6xl font-black text-white tracking-tighter drop-shadow-sm mb-1">
              {profile?.name}
            </h1>
            <p className="text-white/60 font-black tracking-[1px] text-lg">
              {profile?.shopName}
            </p>
          </div>

          {/* Action Button */}
          <div className="pb-4">
            {!isEditing ? (
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                className="bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white hover:text-slate-950 transition-all rounded-lg px-12 py-5 flex items-center gap-4 font-black tracking-[3px] text-xs shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-[1.05] active:scale-[0.95]">
                <Edit2 size={18} /> EDIT PROFILE
              </Button>
            ) : (
              <div className="flex gap-4">
                <Button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-[64px] w-[64px] flex items-center justify-center bg-white/5 text-white border border-white/20 hover:bg-white hover:text-slate-900 rounded-lg shadow-lg transition-all backdrop-blur-md">
                  <X size={24} className="stroke-[2.5]" />
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="bg-white text-slate-950 hover:bg-slate-100 rounded-lg px-12 py-5 font-black tracking-[3px] text-xs flex items-center gap-4 shadow-[0_25px_50px_rgba(0,0,0,0.15)] h-[64px]">
                  {isSaving ? (
                    "UPDATING..."
                  ) : (
                    <>
                      <Save size={20} /> SAVE CHANGES
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="md:col-span-2 space-y-8">
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
            <h3 className="text-xl font-black text-slate-900 mb-8 border-b border-slate-50 pb-4">
              Business Profile
            </h3>

            <form className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Seller Identity
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Store Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Store size={18} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Contact Number
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Card>

          {/* Location Settings Card */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
              <h3 className="text-xl font-black text-slate-900">
                Store Location
              </h3>
              {!isEditing && (
                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-red-500 text-white hover:bg-red-600 rounded-lg px-6 py-2 text-[10px] font-black tracking-[2px]">
                  MANAGE
                </Button>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100/50 space-y-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
                        formData.lat
                          ? "bg-emerald-100 text-emerald-600 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)]"
                          : "bg-white text-slate-400 shadow-sm"
                      }`}>
                      <MapPin size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">
                        {formData.lat
                          ? "Store Location Pin"
                          : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium max-w-[400px] leading-relaxed">
                        {formData.address ||
                          "Click change to precisely mark your shop location on the map for delivery accuracy."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      disabled={isLocationSaving}
                      className="bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-900 rounded-lg px-8 py-3 text-[10px] font-black tracking-[2px] shadow-sm hover:shadow-md transition-all whitespace-nowrap">
                      {isLocationSaving ? "UPDATING..." : "CHANGE PIN"}
                    </Button>
                  )}
                </div>

                {formData.lat !== null && formData.lat !== undefined && (
                  <div className="pt-6 border-t border-slate-200/60 flex flex-wrap gap-8">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Latitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Longitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <Shield size={16} className="text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  Your shop location is used for delivery routing inside your
                  assigned service zone. Place the marker exactly at your
                  physical storefront.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Card */}
        <div className="space-y-8">
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[40px] bg-gradient-to-br from-red-600 via-red-600/95 to-red-800 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-white/40 mb-6">
              Security & Trust
            </h4>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Verification
                  </p>
                  <p className="text-sm font-bold">
                    {profile?.isVerified
                      ? "Verified Merchant"
                      : "Verification Pending"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Star size={20} className="text-white" fill="currentColor" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Seller Rating
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold">
                      {Number(profile?.rating || 0).toFixed(1)}
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          fill={
                            star <= Math.round(Number(profile?.rating || 0))
                              ? "currentColor"
                              : "none"
                          }
                          className={
                            star <= Math.round(Number(profile?.rating || 0))
                              ? "text-yellow-400"
                              : "text-white/30"
                          }
                        />
                      ))}
                    </div>
                    {profile?.totalRatings > 0 && (
                      <span className="text-xs text-white/60 ml-2">
                        ({profile.totalRatings} reviews)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Rocket size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Partner Tier
                  </p>
                  <p className="text-sm font-bold">Standard Growth</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Globe size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Region
                  </p>
                  <p className="text-sm font-bold">Pan India Reach</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[40px] bg-white border border-slate-100">
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-slate-400 mb-6">
              Session Management
            </h4>
            <div className="space-y-6">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Sign out of your current seller workspace session on this device.
              </p>
              <Button
                type="button"
                onClick={logout}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-black tracking-[2px] text-xs py-4 rounded-xl shadow-lg hover:shadow-red-500/30 transition-all flex items-center justify-center gap-3">
                <LogOut size={16} /> SIGN OUT
              </Button>
            </div>
          </Card>

          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[40px] bg-red-50/50 border border-red-100/50">
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-red-600 mb-6">
              Danger Zone
            </h4>
            <div className="space-y-6">
              <p className="text-xs text-red-700/80 font-medium leading-relaxed">
                Once you delete your seller account, you will lose access to all products, active orders, and shop history. This action is soft-delete and cannot be undone unless reactivated by an admin.
              </p>
              <Button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-black tracking-[2px] text-xs py-4 rounded-xl shadow-lg hover:shadow-red-600/20 transition-all flex items-center justify-center gap-3">
                <Trash2 size={16} /> DELETE ACCOUNT
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 font-['Outfit']">
            <div className="flex items-center gap-3 mb-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-black text-slate-900">
                Delete Seller Account?
              </h3>
            </div>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Are you sure you want to delete your merchant account? This will disable your shop and active catalog listings. Your transaction records will remain archived.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl py-3 text-xs font-black tracking-[2px] border-slate-200 hover:bg-slate-50"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                KEEP IT
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black tracking-[2px] text-xs py-3 shadow-md hover:shadow-red-600/20"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? "DELETING..." : "YES, DELETE"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={initialLocation}
          zoneCoordinates={selectedZone?.coordinates || []}
          zoneLabel={
            selectedZone?.label ||
            profile?.shopInfo?.zoneName ||
            ""
          }
        />
      )}
    </div>
  );
};

export default SellerProfile;
