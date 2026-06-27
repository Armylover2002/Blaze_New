import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronRight, Truck } from 'lucide-react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { toast } from 'sonner';

export default function VehicleSwitcherSheet({ isOpen, onClose }) {
  const { driverVehicles, activeVehicleId, setActiveVehicle, isOnline } = useDeliveryStore();

  if (!isOpen) return null;

  const handleSelectVehicle = (vehicle) => {
    if (vehicle.verificationStatus !== 'Approved') {
      toast.error('Vehicle is not approved yet.');
      return;
    }
    if (isOnline) {
      toast.error('You must go offline to change your active vehicle.');
      return;
    }
    const success = setActiveVehicle(vehicle.id || vehicle.vehicleId);
    if (success) {
      toast.success('Active vehicle updated');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full bg-[#121212] rounded-t-3xl shadow-2xl p-6 border-t border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Switch Vehicle</h2>
        <p className="text-sm text-gray-400 mb-6">
          {isOnline ? (
            <span className="text-red-400 font-medium">You must go offline before changing your active vehicle.</span>
          ) : (
            'Select the vehicle you are using for this session.'
          )}
        </p>

        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pb-4">
          {driverVehicles && driverVehicles.length > 0 ? (
            driverVehicles.map((vehicle, idx) => {
              const vId = vehicle.id || vehicle.vehicleId;
              const isActive = vId === activeVehicleId;
              const isApproved = vehicle.verificationStatus === 'Approved';
              const isPending = vehicle.verificationStatus === 'Pending' || vehicle.verificationStatus === 'Under Verification';
              
              const master = vehicle.master || vehicle;
              const services = master.supportedServices || [];
              
              return (
                <div 
                  key={vId || idx}
                  onClick={() => handleSelectVehicle(vehicle)}
                  className={`relative overflow-hidden rounded-2xl p-4 border transition-all ${isActive ? 'bg-green-500/10 border-green-500/30' : isApproved ? 'bg-white/5 border-white/10 active:scale-95 cursor-pointer' : 'bg-white/5 border-white/5 opacity-60 grayscale'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                       <img src={master.image || "https://i.ibb.co/68zRzVv/Auto.png"} alt="Vehicle" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-bold truncate">{master.name || 'Vehicle'}</h3>
                        {isActive && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2 truncate">
                        <span>{vehicle.registrationNumber || 'No Reg'}</span>
                        <span>•</span>
                        <span className={isApproved ? 'text-green-400' : isPending ? 'text-orange-400' : 'text-red-400'}>
                          {vehicle.verificationStatus || 'Unknown'}
                        </span>
                      </div>
                      {isApproved && services.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {services.map(s => (
                            <span key={s} className="text-[9px] bg-white/10 text-white px-1.5 py-0.5 rounded font-black uppercase">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
               <Truck className="w-12 h-12 text-white/20 mx-auto mb-3" />
               <p className="text-white/50 text-sm">No vehicles found.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
