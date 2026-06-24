import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChefHat, MapPin, Phone, 
  ChevronDown, ChevronUp, Package, 
  Navigation, CheckCircle2, Camera, Loader2, Image as ImageIcon,
  RotateCcw, UserRound
} from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { uploadAPI } from '@food/api';
import { toast } from 'sonner';
import { openCamera } from "@food/utils/imageUploadUtils";
import { isMixedOrder, isReturnPickupTrip, normalizePickupPoints, getReturnPickupStopLabels } from '@/modules/DeliveryV2/utils/orderRouting';

const RETURN_OTP_LENGTH = 4;

const ReturnCustomerOtpInput = ({ otp, onChange }) => {
  const inputRefs = useRef([]);

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const next = [...otp];
    next[index] = value.substring(value.length - 1);
    onChange(next);
    if (value && index < RETURN_OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2.5">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleOtpChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className="w-11 h-12 rounded-xl border-2 border-red-200 bg-white text-center text-xl font-black text-gray-900 focus:border-red-500 outline-none shadow-sm"
        />
      ))}
    </div>
  );
};

/**
 * PickupActionModal - Unified White/Green Theme with Slider Actions.
 * Includes Bill Upload feature prior to pickup.
 */
export const PickupActionModal = ({ 
  order, 
  status, 
  isWithinRange, 
  distanceToTarget,
  eta,
  onReachedPickup, 
  onPickedUp,
  onMinimize
}) => {
  const [showItems, setShowItems] = useState(false);
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [billImageUploaded, setBillImageUploaded] = useState(false);
  const [billImageUrl, setBillImageUrl] = useState(null);
  const [customerOtpDigits, setCustomerOtpDigits] = useState(['', '', '', '']);
  const cameraInputRef = useRef(null);

  const customerOtp = customerOtpDigits.join('');

  if (!order) return null;

  const isReturnPickup = isReturnPickupTrip(order);
  const returnLabels = getReturnPickupStopLabels();

  const handleBillImageSelect = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setIsUploadingBill(true);
    try {
      const res = await uploadAPI.uploadMedia(file, { folder: 'appzeto/delivery/bills' });
      if (res?.data?.success && res?.data?.data) {
        setBillImageUrl(res.data.data.url || res.data.data.secure_url);
        setBillImageUploaded(true);
        // toast.success('Bill image uploaded!');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      toast.error('Failed to upload bill image');
      setBillImageUploaded(false);
      setBillImageUrl(null);
    } finally {
      setIsUploadingBill(false);
    }
  };

  const handleTakeCameraPhoto = () => {
    openCamera({
      onSelectFile: (file) => handleBillImageSelect(file),
      fileNamePrefix: `bill-${order.orderId || order._id}`
    })
  }

  const handlePickFromGallery = () => {
    cameraInputRef.current?.click()
  }

  const isAtPickup = status === 'REACHED_PICKUP';
  const isQuickOrder = String(order?.orderType || order?.serviceType || order?.type || '').trim().toLowerCase() === 'quick';
  const restaurantName = isReturnPickup
    ? order?.customerName || order?.userName || 'Customer'
    : isQuickOrder
    ? order?.storeName || order?.sellerName || order?.seller?.shopName || order?.seller?.name || 'Seller store'
    : order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant';
  const restaurantAddress = isReturnPickup
    ? order?.customerAddress || order?.deliveryAddress?.formattedAddress || 'Customer address'
    : isQuickOrder
    ? order?.storeAddress || order?.sellerAddress || order?.seller?.location?.address || order?.seller?.location?.formattedAddress || 'Address not available'
    : order?.restaurantAddress || order?.restaurant_address || order?.restaurantLocation?.address || 'Address not available';
  const restaurantPhone = isQuickOrder
    ? order?.storePhone || order?.sellerPhone || order?.seller?.phone || ''
    : order?.restaurantPhone || order?.restaurant_phone || order?.restaurantId?.phone || '';
  const items = order.items || [];
  const restaurantLogo = isQuickOrder
    ? order?.storeImage || order?.seller?.logo || order?.seller?.image || order?.seller?.profileImage || 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png'
    : order?.restaurantImage || order?.restaurant?.logo || order?.restaurant?.profileImage || 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png';
  const pickupPoints = normalizePickupPoints(order);
  const mixedOrder = isMixedOrder(order);
  const pickupStops = pickupPoints.length
    ? pickupPoints
    : [
        {
          id: 'food:primary',
          pickupType: isQuickOrder ? 'quick' : 'food',
          sourceName: restaurantName,
          address: restaurantAddress,
          phone: restaurantPhone,
        },
      ];
  const primaryStop = pickupStops[0] || null;
  const primaryPickupType = primaryStop?.pickupType === 'quick' ? 'quick' : 'food';
  const primaryName = primaryStop?.sourceName || restaurantName;
  const primaryAddress = primaryStop?.address || restaurantAddress;
  const primaryPhone = primaryStop?.phone || restaurantPhone;
  const primaryDestinationLabel = isReturnPickup ? 'Customer' : primaryPickupType === 'quick' ? 'Store' : 'Restaurant';
  const canConfirmPickup = isReturnPickup
    ? billImageUploaded && customerOtp.length >= RETURN_OTP_LENGTH
    : billImageUploaded;

  const returnPickupLockedLabel = !billImageUploaded && customerOtp.length < RETURN_OTP_LENGTH
    ? 'Upload photo & enter OTP'
    : !billImageUploaded
      ? 'Upload return item photo'
      : 'Enter customer OTP';

  const compactReturnReached = isReturnPickup && isAtPickup;
  const showPickupStops = !compactReturnReached;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[110] p-0 sm:p-2 sm:mb-2 flex items-end justify-center max-h-full">
      {/* Background Dim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-x-0 top-0 bottom-0 bg-black/40 -z-10"
      />

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className={`w-full max-w-lg bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.2)] overflow-y-auto overscroll-y-contain ${
          compactReturnReached
            ? 'rounded-t-[1.25rem] p-3 pb-4 max-h-[min(72vh,560px)]'
            : 'rounded-t-[2rem] p-4 pb-8 max-h-[min(82vh,680px)]'
        }`}
      >
        {/* Handle / Minimize */}
        <div className={`w-full flex justify-center ${compactReturnReached ? 'pb-2 pt-0' : 'pb-4 pt-1'}`}>
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
             <ChevronDown className="w-5 h-5 text-gray-400 stroke-[3]" />
          </button>
        </div>

        {/* Restaurant Header */}
        <div className={`flex items-start justify-between border-b border-gray-50 ${
          compactReturnReached ? 'mb-3 pb-2' : 'mb-4 pb-3'
        }`}>
          <div className="flex gap-3 min-w-0 flex-1">
            {!compactReturnReached && (
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5 overflow-hidden border border-gray-100 shrink-0">
                <img src={restaurantLogo} alt="Logo" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className={`text-gray-950 font-bold truncate ${compactReturnReached ? 'text-lg' : 'text-xl'}`}>{primaryName}</h3>
              {isReturnPickup && (
                <div className="mt-1 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-700">
                  Return Pickup
                </div>
              )}
              {mixedOrder && (
                <div className="mt-2 inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-600">
                  Mixed Order
                </div>
              )}
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-1.5">
                {isAtPickup ? (
                  <span className="text-green-600">Reached Location √</span>
                ) : (
                  <span className="text-red-500">
                    {(distanceToTarget / 1000).toFixed(1)} km • {eta || '--'} min to {primaryDestinationLabel}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {primaryPhone && (
              <button
                onClick={() => window.location.href = `tel:${primaryPhone}`}
                className={`w-9 h-9 rounded-full flex items-center justify-center border ${
                  isReturnPickup
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-green-50 text-green-600 border-green-100'
                }`}
              >
                <Phone className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryAddress)}`, '_blank')}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg ${
                isReturnPickup ? 'bg-red-600' : 'bg-gray-900'
              }`}
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showPickupStops && (
        <div className="mb-4 space-y-2">
          {pickupStops.map((pickup, index) => {
            const isQuickStore = pickup.pickupType === 'quick';
            const label = isReturnPickup
              ? returnLabels.pickupLabel
              : isQuickStore
                ? 'Store Pickup'
                : 'Restaurant Pickup';
            const accentClasses = isReturnPickup
              ? 'text-red-700 bg-red-50 border-red-200'
              : isQuickStore
                ? 'text-red-600 bg-red-50 border-red-100'
                : 'text-green-600 bg-green-50 border-green-100';

            return (
              <div
                key={pickup.id || `${pickup.pickupType}-${index}`}
                className="rounded-xl border border-gray-100 bg-gray-50/80 p-3"
              >
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${accentClasses}`}>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{pickupStops.length > 1 ? `${label} ${index + 1}` : label}</span>
                </div>
                <p className="mt-3 text-base font-bold text-gray-950">{pickup.sourceName || primaryName}</p>
                {(pickup.phone || primaryPhone) ? (
                  <p className="mt-1 text-sm font-semibold text-gray-700">{pickup.phone || primaryPhone}</p>
                ) : null}
                <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">{pickup.address || primaryAddress || 'Address not available'}</p>
              </div>
            );
          })}
        </div>
        )}

        {/* Action Sliders */}
        <div className={compactReturnReached ? 'space-y-3' : 'space-y-4'}>
          {!isAtPickup ? (
            <div>
              <p className={`text-center text-[10px] font-bold uppercase tracking-widest mb-3 transition-colors ${
                isWithinRange ? 'text-green-600' : 'text-red-500 animate-pulse'
              }`}>
                {isWithinRange ? 'Ready - Swipe to confirm arrival' : 'Get closer to pickup point'}
              </p>
              <ActionSlider 
                key="action-reach"
                label="Slide to Reach" 
                lockedLabel={isReturnPickup ? 'Get closer to customer' : 'Get closer to pickup point'}
                successLabel="Reached!"
                disabled={!isWithinRange}
                onConfirm={onReachedPickup}
                color="bg-[#FF0000]"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {isReturnPickup ? (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-red-600">
                        Return Pickup Verification
                      </p>
                      <p className="text-xs font-semibold text-gray-700 leading-snug">
                        Ask customer for 4-digit handover code
                      </p>
                    </div>
                  </div>

                  <ReturnCustomerOtpInput
                    otp={customerOtpDigits}
                    onChange={setCustomerOtpDigits}
                  />

                  <div className="flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-widest">
                    <span className={billImageUploaded ? 'text-green-600' : 'text-gray-400'}>
                      {billImageUploaded ? '✓' : '○'} Photo
                    </span>
                    <span className={customerOtp.length >= RETURN_OTP_LENGTH ? 'text-green-600' : 'text-gray-400'}>
                      {customerOtp.length >= RETURN_OTP_LENGTH ? '✓' : '○'} OTP
                    </span>
                  </div>

                  <div className="flex justify-center items-center gap-2 w-full">
                    {!billImageUploaded && !isUploadingBill && (
                      <>
                        <button
                          onClick={handleTakeCameraPhoto}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Camera</span>
                        </button>
                        <button
                          onClick={handlePickFromGallery}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span>Gallery</span>
                        </button>
                      </>
                    )}
                    {isUploadingBill && (
                      <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </div>
                    )}
                    {billImageUploaded && (
                      <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-100 text-green-700 font-bold text-[10px] uppercase tracking-widest">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Photo Uploaded</span>
                      </div>
                    )}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleBillImageSelect(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center items-center gap-3 w-full">
                    {!billImageUploaded && !isUploadingBill && (
                      <>
                        <button
                          onClick={handleTakeCameraPhoto}
                          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-900 text-white font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                        >
                          <Camera className="w-5 h-5" />
                          <span>Camera</span>
                        </button>
                        <button
                          onClick={handlePickFromGallery}
                          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
                        >
                          <ImageIcon className="w-5 h-5" />
                          <span>Gallery</span>
                        </button>
                      </>
                    )}
                    {isUploadingBill && (
                      <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-50 text-gray-400 font-bold text-xs uppercase tracking-widest">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading...</span>
                      </div>
                    )}
                    {billImageUploaded && (
                      <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-100 text-green-700 font-bold text-xs uppercase tracking-widest">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Bill Uploaded</span>
                      </div>
                    )}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleBillImageSelect(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              <div>
                <p className={`text-center text-[9px] font-bold uppercase tracking-widest mb-2 ${canConfirmPickup ? 'text-green-600' : isReturnPickup ? 'text-red-500' : 'text-gray-400'}`}>
                  {isReturnPickup
                    ? (canConfirmPickup ? 'Swipe to confirm pickup' : 'Complete photo + OTP to unlock')
                    : (billImageUploaded ? "Check the restaurant logo - Swipe to pick up" : "Capture bill to unlock swipe")}
                </p>
                <ActionSlider 
                  key="action-pickup"
                  label={isReturnPickup ? "Slide to Confirm Pickup" : "Slide to Pick Up"}
                  lockedLabel={isReturnPickup ? returnPickupLockedLabel : 'Upload bill to unlock'}
                  successLabel="Picked Up!"
                  disabled={!canConfirmPickup}
                  onConfirm={() => onPickedUp(billImageUrl, {
                    otp: customerOtp,
                    customerOtp,
                    pickupImages: billImageUrl ? [billImageUrl] : [],
                  })}
                  color="bg-[#FF0000]"
                />
              </div>
            </div>
          )}

          {/* Delivery Instructions (User Note) */}
          {order?.note && (
            <div className={`bg-red-50 border border-red-100 rounded-xl flex gap-2.5 items-start ${
              compactReturnReached ? 'p-2.5' : 'p-3'
            }`}>
              {isReturnPickup ? (
                <UserRound className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <ChefHat className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1">
                  {isReturnPickup ? 'Return Reason' : 'User Instructions'}
                </p>
                <p className={`font-bold text-gray-800 leading-snug ${compactReturnReached ? 'text-xs' : 'text-sm'}`}>"{order.note}"</p>
              </div>
            </div>
          )}

          {/* Collapsible Order Summary */}
          <button 
            onClick={() => setShowItems(!showItems)}
            className={`w-full flex items-center justify-between bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors ${
              compactReturnReached ? 'p-2.5' : 'p-3'
            }`}
          >
            <div className="flex items-center gap-2 text-gray-900 font-bold text-[10px] uppercase tracking-widest">
              <Package className="w-4 h-4 text-gray-400" />
              <span>Order Details ({items.length || 0})</span>
            </div>
            {showItems ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {showItems && (
            <div className="overflow-hidden space-y-2 px-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700 text-sm font-bold">{item.name || 'Item Name'}</span>
                  <span className={`font-bold px-2.5 py-1 rounded-lg text-xs ${
                    isReturnPickup ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                  }`}>x{item.quantity || 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PickupActionModal;
