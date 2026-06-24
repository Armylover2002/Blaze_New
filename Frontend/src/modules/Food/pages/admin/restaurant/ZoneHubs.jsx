import { useState, useEffect, useMemo } from "react";
import { 
  MapPin, 
  Plus, 
  Search, 
  Building, 
  Phone, 
  User, 
  Check, 
  X, 
  AlertTriangle, 
  Info, 
  Map, 
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  MapPinned,
  Trash2,
  Eye,
  Mail,
  Home
} from "lucide-react";
import { adminAPI } from "@food/api";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { 
  canPerformAdminPermissionAction, 
  extractAdminPermissions, 
  extractAdminRoleId, 
  fetchAdminRolePermissions 
} from "@food/utils/adminPermissions";
import { toast } from "sonner";

const debugError = (...args) => console.error("[ZoneHubs]", ...args);

export default function ZoneHubs() {
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [resolvedPermissions, setResolvedPermissions] = useState({});

  // Auth & Permissions Resolve
  useEffect(() => {
    let isMounted = true;
    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      const existingPermissions = extractAdminPermissions(currentUser);
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions);
        return;
      }

      const roleId = extractAdminRoleId(currentUser);
      if (!roleId) {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId);
        if (isMounted) setResolvedPermissions(rolePermissions);
      } catch {
        if (isMounted) setResolvedPermissions({});
      }
    };

    resolvePermissions();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const canManage = useMemo(() => {
    return currentUser?.role === "ADMIN" || canPerformAdminPermissionAction(
      currentUser,
      resolvedPermissions,
      "food::restaurant_management::zone_setup",
      "edit"
    );
  }, [currentUser, resolvedPermissions]);

  // UI Flow States
  // 'zones' -> Displays all operational zones
  // 'hubs' -> Displays hubs inside a selected zone
  const [currentView, setCurrentView] = useState("zones");
  const [selectedZoneId, setSelectedZoneId] = useState(null);

  // Main Listings States
  const [zoneHubs, setZoneHubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedHubDetails, setSelectedHubDetails] = useState(null);
  
  const [modalLoadingRestaurants, setModalLoadingRestaurants] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalSelectedRestaurantId, setModalSelectedRestaurantId] = useState("");
  const [modalRestaurants, setModalRestaurants] = useState([]);

  // Fetch Zone Hubs list
  const fetchZoneHubs = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getZoneHubs({ limit: 100 });
      if (response.data?.success && response.data.data?.zoneHubs) {
        setZoneHubs(response.data.data.zoneHubs);
      }
    } catch (error) {
      debugError("Error fetching zone hubs:", error);
      toast.error("Failed to load zone hubs listing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZoneHubs();
  }, []);

  // Fetch restaurants when zone is selected in the Add modal
  const [activeAddZoneId, setActiveAddZoneId] = useState("");
  useEffect(() => {
    if (!activeAddZoneId) {
      setModalRestaurants([]);
      setModalSelectedRestaurantId("");
      return;
    }

    const fetchRestaurants = async () => {
      try {
        setModalLoadingRestaurants(true);
        const response = await adminAPI.getRestaurantsInZone(activeAddZoneId);
        if (response.data?.success && response.data.data) {
          setModalRestaurants(response.data.data);
          setModalSelectedRestaurantId("");
        }
      } catch (error) {
        debugError("Error fetching restaurants for zone:", error);
        toast.error("Failed to load restaurants for the selected zone");
      } finally {
        setModalLoadingRestaurants(false);
      }
    };

    fetchRestaurants();
  }, [activeAddZoneId]);

  // Filtering zones locally
  const filteredZones = useMemo(() => {
    return zoneHubs.filter(z => 
      z.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.zoneName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [zoneHubs, searchQuery]);

  // Selected Zone detail object
  const selectedZone = useMemo(() => {
    return zoneHubs.find(z => z.id === selectedZoneId);
  }, [zoneHubs, selectedZoneId]);

  // Navigate to Zone detail
  const handleZoneClick = (zoneId) => {
    setSelectedZoneId(zoneId);
    setCurrentView("hubs");
  };

  // Back to Zones list
  const handleBackToZones = () => {
    setCurrentView("zones");
    setSelectedZoneId(null);
  };

  // Open Hub View Details popup
  const handleViewHubDetails = (hub) => {
    setSelectedHubDetails(hub);
    setShowViewModal(true);
  };

  // Open designation Modal
  const handleOpenAddModal = (zoneId) => {
    if (!canManage) {
      toast.error("You do not have permission to manage Zone Hubs");
      return;
    }
    setActiveAddZoneId(zoneId);
    setShowAddModal(true);
  };

  // Submit new Hub
  const handleSaveZoneHub = async (e) => {
    e.preventDefault();
    if (!activeAddZoneId) {
      toast.error("Zone context is missing");
      return;
    }
    if (!modalSelectedRestaurantId) {
      toast.error("Please select a restaurant");
      return;
    }

    try {
      setModalSaving(true);
      const response = await adminAPI.createZoneHub({
        zoneId: activeAddZoneId,
        restaurantId: modalSelectedRestaurantId,
        action: 'assign'
      });

      if (response.data?.success) {
        toast.success("Zone Hub designated successfully!");
        setShowAddModal(false);
        await fetchZoneHubs();
      } else {
        toast.error(response.data?.message || "Failed to assign Zone Hub");
      }
    } catch (error) {
      debugError("Error saving zone hub:", error);
      toast.error(error.response?.data?.message || "Failed to designate Zone Hub");
    } finally {
      setModalSaving(false);
    }
  };

  // Remove individual Hub restaurant
  const handleRemoveHubRestaurant = async (zoneId, restaurantId) => {
    if (!canManage) {
      toast.error("You do not have permission to manage Zone Hubs");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this designated Zone Hub restaurant?")) {
      return;
    }

    try {
      setLoading(true);
      const response = await adminAPI.createZoneHub({
        zoneId,
        restaurantId,
        action: 'unassign'
      });

      if (response.data?.success) {
        toast.success("Zone Hub restaurant removed successfully");
        await fetchZoneHubs();
      } else {
        toast.error(response.data?.message || "Failed to remove Zone Hub");
      }
    } catch (error) {
      debugError("Error removing zone hub:", error);
      toast.error(error.response?.data?.message || "Failed to remove Zone Hub");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50/50 min-h-screen font-sans">
      <div className="w-full mx-auto max-w-7xl">
        
        {/* VIEW 1: ZONES LIST SCREEN */}
        {currentView === "zones" && (
          <div className="space-y-6">
            
            {/* Elegant Header Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 shadow-lg shadow-indigo-950/10">
              <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
              <div className="absolute left-1/3 bottom-0 -mb-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
              
              <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center backdrop-blur-sm">
                    <MapPinned className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Zone Hub Setup</h1>
                    <p className="text-slate-300 text-sm md:text-base mt-1 font-medium">
                      Manage delivery hubs inside operational zones. Click on any zone below to view its hubs or add new ones.
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
                  placeholder="Search operational zones..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm shadow-sm font-medium"
                />
              </div>
              <div className="bg-white border border-slate-100 px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 shadow-sm self-start sm:self-auto uppercase tracking-wider">
                Total: <span className="text-slate-900 font-bold">{filteredZones.length} zones</span>
              </div>
            </div>

            {/* Zones Table List */}
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                <div className="relative w-10 h-10 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                </div>
                <p className="text-slate-550 text-sm font-semibold">Loading operational zones listing...</p>
              </div>
            ) : filteredZones.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                <MapPin className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                <h3 className="text-slate-800 font-bold text-lg">No Zones Found</h3>
                <p className="text-slate-500 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed font-medium">
                  {searchQuery ? "Try refining your search keyword." : "Configure delivery zones first under the Zone Setup tab."}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">
                        <th className="px-6 py-4 w-16">#</th>
                        <th className="px-6 py-4">Zone Name</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Designated Hubs</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {filteredZones.map((zone, index) => {
                        const hubsCount = zone.hubs?.length || 0;
                        return (
                          <tr 
                            key={zone.id} 
                            onClick={() => handleZoneClick(zone.id)}
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-4 text-slate-400 font-semibold">{index + 1}</td>
                            <td className="px-6 py-4 font-bold text-slate-800 group-hover:text-indigo-650 transition-colors">
                              {zone.zoneName || zone.name}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase border ${
                                zone.isActive 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                  : "bg-slate-100 text-slate-650 border-slate-200"
                              }`}>
                                {zone.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {hubsCount > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{hubsCount} Hub{hubsCount > 1 ? "s" : ""} Assigned</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  <span>No Hubs</span>
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleZoneClick(zone.id);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-all shadow-sm"
                              >
                                <span>View Hubs</span>
                                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* VIEW 2: DRILL-DOWN HUBS LIST FOR SELECTED ZONE */}
        {currentView === "hubs" && selectedZone && (
          <div className="space-y-6">
            
            {/* Nav Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToZones}
                  className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-650 hover:text-slate-900 rounded-xl transition-all shadow-sm flex items-center justify-center"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-indigo-600 tracking-wider uppercase">Operational Zone</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${selectedZone.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {selectedZone.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                    {selectedZone.zoneName || selectedZone.name} Hubs List
                  </h1>
                </div>
              </div>

              {canManage && (
                <button
                  onClick={() => handleOpenAddModal(selectedZone.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl shadow-md shadow-indigo-500/10 font-semibold text-xs uppercase tracking-wide transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Zone Hub</span>
                </button>
              )}
            </div>

            {/* Hubs List Table */}
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                <div className="relative w-8 h-8 mx-auto mb-3">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                </div>
                <p className="text-slate-550 text-sm">Refreshing hubs list...</p>
              </div>
            ) : !selectedZone.hubs || selectedZone.hubs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm max-w-xl mx-auto space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-500">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-slate-850 font-bold text-base">No flagship Hubs assigned</h3>
                  <p className="text-slate-500 text-xs leading-relaxed mt-1 font-medium">
                    There are no flagship hub restaurants configured for {selectedZone.zoneName || selectedZone.name} yet. Adding a hub enables seamless physical COD cash settlements for delivery partners.
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleOpenAddModal(selectedZone.id)}
                    className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Designate Flagship Hub</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">
                        <th className="px-6 py-4 w-16">#</th>
                        <th className="px-6 py-4">Restaurant Hub</th>
                        <th className="px-6 py-4">Hotline Phone</th>
                        <th className="px-6 py-4">Manager / Owner</th>
                        <th className="px-6 py-4">Address</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {selectedZone.hubs.map((hub, index) => (
                        <tr key={hub.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-slate-400 font-semibold">{index + 1}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-800 block">{hub.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {hub.displayId || "N/A"}</span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">{hub.phone}</td>
                          <td className="px-6 py-4 font-semibold text-slate-700">{hub.owner}</td>
                          <td className="px-6 py-4 max-w-xs truncate text-slate-600 font-medium" title={`${hub.address}, ${hub.city}`}>
                            {hub.address}, {hub.city}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase shrink-0">
                              {hub.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleViewHubDetails(hub)}
                                className="inline-flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 text-slate-650 hover:text-slate-900 rounded-lg border border-slate-200 transition-all shadow-sm"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              
                              {canManage && (
                                <button
                                  onClick={() => handleRemoveHubRestaurant(selectedZone.id, hub.id)}
                                  className="inline-flex items-center justify-center p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-900 rounded-lg border border-rose-200 transition-all shadow-sm"
                                  title="Remove Hub"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODAL 1: ADD ZONE HUB */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPinned className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg">Designate Flagship Hub</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveZoneHub}>
              <div className="p-6 space-y-5">
                
                {/* Zone Info (Locked Context) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Operational Zone Context
                  </label>
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-150 rounded-xl text-slate-800 font-semibold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <span>{selectedZone?.zoneName || selectedZone?.name}</span>
                  </div>
                </div>

                {/* Restaurant Selector */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Select Restaurant inside Zone
                    </label>
                    {modalLoadingRestaurants && (
                      <span className="text-[10px] text-indigo-600 font-semibold animate-pulse">Loading outlets...</span>
                    )}
                  </div>

                  {modalLoadingRestaurants ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl py-6 text-center text-xs text-slate-400">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Fetching eligible zone restaurants...
                    </div>
                  ) : modalRestaurants.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center text-xs text-amber-700">
                      <div className="flex items-center justify-center gap-1 mb-1 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>No Eligible Restaurants Found</span>
                      </div>
                      Only approved restaurants inside this zone can be designated.
                    </div>
                  ) : (
                    <select
                      value={modalSelectedRestaurantId}
                      onChange={(e) => setModalSelectedRestaurantId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs"
                    >
                      <option value="">-- Choose flagship restaurant --</option>
                      {modalRestaurants.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name} (ID: {res.displayId || "N/A"})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Info Tip */}
                {modalSelectedRestaurantId && (
                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-2 border border-slate-100">
                    <Info className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-slate-550 leading-normal font-medium">
                      Designating this restaurant updates the zone profile. The selected outlet becomes an active flagship pickup/delivery gateway point. Multiple hub restaurants are supported inside a single zone!
                    </p>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={modalSaving}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-750 rounded-xl border border-slate-200 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || !modalSelectedRestaurantId}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50 shadow-md shadow-indigo-600/10"
                >
                  {modalSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Assignment...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Designate Hub</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: VIEW HUB DETAILS */}
      {showViewModal && selectedHubDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in duration-250">
            
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-lg">Restaurant Hub Profile</h3>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-slate-450 hover:text-slate-650 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-6 space-y-5 text-slate-700 text-xs">
              
              <div>
                <span className="text-[10px] font-semibold text-slate-450 uppercase">Outlet Name</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                  {selectedHubDetails.name}
                  <span className="px-2.5 py-0.5 bg-emerald-100 border border-emerald-250 text-emerald-800 text-[10px] font-semibold rounded-full">
                    {selectedHubDetails.status}
                  </span>
                </h3>
              </div>

              <div className="border-t border-slate-100 pt-3.5 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-450 uppercase block">Hub Manager / Owner</span>
                    <span className="font-bold text-slate-800 mt-0.5">{selectedHubDetails.owner}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-450 uppercase block">Hotline Number</span>
                    <span className="font-bold text-slate-800 mt-0.5">{selectedHubDetails.phone}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-450 uppercase block">Physical Address</span>
                    <span className="font-bold text-slate-800 mt-0.5 leading-relaxed">{selectedHubDetails.address}, {selectedHubDetails.city}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4.5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                Close Profile
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
