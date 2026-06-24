import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Search, 
  Check, 
  X, 
  AlertTriangle, 
  Eye, 
  Building, 
  User, 
  Phone, 
  Home
} from "lucide-react";
import { adminAPI } from "@food/api";
import { toast } from "sonner";

const debugError = (...args) => console.error("[AdminCODVerification]", ...args);

export default function AdminCODDepositVerification() {
  const [codRequests, setCodRequests] = useState([]);
  const [loadingCod, setLoadingCod] = useState(true);
  const [selectedCodRequest, setSelectedCodRequest] = useState(null);
  const [showCodModal, setShowCodModal] = useState(false);
  const [codActionNote, setCodActionNote] = useState("");
  const [processingCodId, setProcessingCodId] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCodRequests = async () => {
    try {
      setLoadingCod(true);
      const response = await adminAPI.getCODVerifications();
      if (response.data?.success && response.data.data?.requests) {
        setCodRequests(response.data.data.requests);
      }
    } catch (error) {
      debugError("Error fetching COD verifications:", error);
      toast.error("Failed to load COD verification requests");
    } finally {
      setLoadingCod(false);
    }
  };

  useEffect(() => {
    fetchCodRequests();
  }, []);

  const handleCodAction = async (id, action) => {
    try {
      setProcessingCodId(id);
      const response = await adminAPI.settleCODVerification(id, {
        action,
        adminNote: codActionNote.trim()
      });
      if (response.data?.success) {
        toast.success(`COD Deposit request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
        setShowCodModal(false);
        setSelectedCodRequest(null);
        setCodActionNote("");
        await fetchCodRequests();
      } else {
        toast.error(response.data?.message || "Failed to settle COD deposit");
      }
    } catch (error) {
      debugError("Error settling COD deposit:", error);
      toast.error(error.response?.data?.message || "Failed to settle COD deposit");
    } finally {
      setProcessingCodId(null);
    }
  };

  const filteredRequests = codRequests.filter(req => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      req.deliveryName?.toLowerCase().includes(query) ||
      req.deliveryPhone?.includes(query) ||
      req.zoneHubName?.toLowerCase().includes(query) ||
      req.zoneName?.toLowerCase().includes(query) ||
      String(req.amount).includes(query)
    );
  });

  return (
    <div className="p-4 lg:p-6 bg-slate-50/50 min-h-screen font-sans">
      <div className="w-full mx-auto max-w-7xl space-y-6">
        
        {/* Elegant Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 shadow-lg shadow-indigo-950/10">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="absolute left-1/3 bottom-0 -mb-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center backdrop-blur-sm">
                <ShieldCheck className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">COD Deposit Verification</h1>
                <p className="text-slate-300 text-sm md:text-base mt-1 font-medium">
                  Audit and approve physical cash deposit handovers accepted by flagship Zone Hub restaurants.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Stats Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by rider name, phone, zone, hub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm shadow-sm font-medium"
            />
          </div>
          <div className="bg-white border border-slate-100 px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 shadow-sm uppercase tracking-wider">
            Pending: <span className="text-slate-900 font-bold">{filteredRequests.length} requests</span>
          </div>
        </div>

        {/* List and Details */}
        {loadingCod ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <div className="relative w-10 h-10 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-slate-550 text-sm font-semibold">Loading verification requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <ShieldCheck className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-800 font-bold text-lg">No Pending Approvals</h3>
            <p className="text-slate-500 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed font-medium">
              {searchQuery ? "Try refining your search keyword." : "There are no restaurant-accepted COD deposit requests awaiting admin settlement."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">
                    <th className="px-6 py-4">Rider Details</th>
                    <th className="px-6 py-4">Restaurant Hub</th>
                    <th className="px-6 py-4">Submitted Cash</th>
                    <th className="px-6 py-4">Handover Date</th>
                    <th className="px-6 py-4">Dual Proofs</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 block">{req.deliveryName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{req.deliveryPhone}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 block">{req.zoneHubName}</span>
                        <span className="text-[10px] text-indigo-650 block mt-0.5">Zone: {req.zoneName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-extrabold text-slate-900">₹{req.amount.toLocaleString("en-IN")}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {new Date(req.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {req.paymentProof ? (
                            <button
                              onClick={() => setFullscreenImage(req.paymentProof)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-lg text-[10px] font-bold text-indigo-700 flex items-center gap-1 shadow-sm transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Rider Proof
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Rider Proof</span>
                          )}
                          {req.restaurantProof ? (
                            <button
                              onClick={() => setFullscreenImage(req.restaurantProof)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-105 border border-emerald-150 rounded-lg text-[10px] font-bold text-emerald-700 flex items-center gap-1 shadow-sm transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Hub Proof
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Hub Proof</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedCodRequest(req);
                            setCodActionNote("");
                            setShowCodModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
                        >
                          <span>Audit & Review</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 3: AUDIT COD VERIFICATION REQUEST */}
      {showCodModal && selectedCodRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in duration-250">
            
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg">COD Handover Audit Console</h3>
              </div>
              <button
                onClick={() => {
                  setShowCodModal(false);
                  setSelectedCodRequest(null);
                }}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
              {/* Dual Column Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Delivery Boy Details */}
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-450 uppercase block">RIDER DETAILS</span>
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-800 text-sm">{selectedCodRequest.deliveryName}</p>
                    <p className="font-semibold text-slate-600">Phone: {selectedCodRequest.deliveryPhone}</p>
                    <p className="text-slate-500">ID: {selectedCodRequest.deliveryPartnerIdString}</p>
                  </div>
                </div>

                {/* Restaurant Details */}
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-450 uppercase block">RESTAURANT ZONE HUB DETAILS</span>
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-800 text-sm">{selectedCodRequest.zoneHubName}</p>
                    <p className="font-semibold text-slate-600">Manager: {selectedCodRequest.zoneHubOwnerName}</p>
                    <p className="text-slate-500">Hub ID: {selectedCodRequest.zoneHubDisplayId}</p>
                  </div>
                </div>
              </div>

              {/* Handover Amount & Restaurant Note */}
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-indigo-850">Handover Amount:</span>
                  <span className="text-xl font-black text-indigo-700">₹{selectedCodRequest.amount.toLocaleString("en-IN")}</span>
                </div>
                {selectedCodRequest.restaurantNote && (
                  <div className="border-t border-indigo-100/50 pt-2.5 mt-2">
                    <span className="font-bold text-indigo-800 block">Hub Review Note:</span>
                    <p className="text-slate-700 font-medium italic mt-0.5">"{selectedCodRequest.restaurantNote}"</p>
                  </div>
                )}
              </div>

              {/* Dual Proof Pictures */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-3">PHYSICAL PAYMENT PROOF SCREENSHOTS</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Rider Proof */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 block">Uploaded by Rider:</span>
                    {selectedCodRequest.paymentProof ? (
                      <div 
                        onClick={() => setFullscreenImage(selectedCodRequest.paymentProof)}
                        className="relative h-44 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 cursor-pointer group"
                      >
                        <img src={selectedCodRequest.paymentProof} alt="Rider Proof" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white animate-pulse" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-44 rounded-xl border border-dashed border-slate-350 flex items-center justify-center text-xs text-slate-400 bg-slate-50 italic">
                        No image uploaded
                      </div>
                    )}
                  </div>

                  {/* Restaurant Proof */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 block">Uploaded by Restaurant:</span>
                    {selectedCodRequest.restaurantProof ? (
                      <div 
                        onClick={() => setFullscreenImage(selectedCodRequest.restaurantProof)}
                        className="relative h-44 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 cursor-pointer group"
                      >
                        <img src={selectedCodRequest.restaurantProof} alt="Restaurant Proof" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white animate-pulse" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-44 rounded-xl border border-dashed border-slate-350 flex items-center justify-center text-xs text-slate-400 bg-slate-50 italic">
                        No image uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Settlement Reason */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Settlement Review Comment (Optional)</label>
                <textarea
                  value={codActionNote}
                  onChange={(e) => setCodActionNote(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 text-slate-800"
                  rows={2}
                  placeholder="e.g. Verified dual payment receipts, cash count matches, and rider wallet limit has been settled."
                />
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowCodModal(false);
                  setSelectedCodRequest(null);
                }}
                className="px-4.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold transition-all"
              >
                Cancel
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={processingCodId === selectedCodRequest.id}
                  onClick={() => handleCodAction(selectedCodRequest.id, "reject")}
                  className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-rose-200 shadow-sm"
                >
                  <X className="w-4 h-4" />
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  disabled={processingCodId === selectedCodRequest.id}
                  onClick={() => handleCodAction(selectedCodRequest.id, "approve")}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-650/10"
                >
                  {processingCodId === selectedCodRequest.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Approve & Settle</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE VIEWER MODAL */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col" onClick={() => setFullscreenImage(null)}>
          <div className="p-4 flex items-center justify-end">
            <button onClick={() => setFullscreenImage(null)} className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={fullscreenImage} alt="Fullscreen proof" className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl animate-in zoom-in duration-200" />
          </div>
        </div>
      )}

    </div>
  );
}
