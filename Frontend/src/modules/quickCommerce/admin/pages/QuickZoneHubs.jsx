import { useState, useEffect } from "react"
import { MapPin, Search, Check, Plus, Trash2, Shield, AlertCircle, RefreshCw, X, Building2, CheckSquare } from "lucide-react"
import { adminApi } from "../services/adminApi"

export default function QuickZoneHubs() {
  const [zones, setZones] = useState([])
  const [selectedZone, setSelectedZone] = useState(null)
  const [sellers, setSellers] = useState([])
  const [loadingZones, setLoadingZones] = useState(true)
  const [loadingSellers, setLoadingSellers] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [message, setMessage] = useState(null)

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [modalSearchQuery, setModalSearchQuery] = useState("")
  const [modalSelectedSellerIds, setModalSelectedSellerIds] = useState([])

  useEffect(() => {
    fetchZones()
  }, [])

  useEffect(() => {
    if (selectedZone) {
      fetchSellers(selectedZone._id || selectedZone.id)
    } else {
      setSellers([])
    }
  }, [selectedZone])

  const fetchZones = async () => {
    try {
      setLoadingZones(true)
      const response = await adminApi.getZones()
      if (response.data?.success && response.data.data?.zones) {
        const zoneList = response.data.data.zones
        setZones(zoneList)
        if (zoneList.length > 0) {
          setSelectedZone(zoneList[0])
        }
      }
    } catch (error) {
      console.error("Error fetching zones:", error)
    } finally {
      setLoadingZones(false)
    }
  }

  const fetchSellers = async (zoneId) => {
    try {
      setLoadingSellers(true)
      setMessage(null)
      const response = await adminApi.getQuickZoneSellers(zoneId)
      if (response.data?.success && response.data.result) {
        setSellers(response.data.result)
      }
    } catch (error) {
      console.error("Error fetching zone sellers:", error)
      setSellers([])
    } finally {
      setLoadingSellers(false)
    }
  }

  const handleRemoveHub = async (sellerId) => {
    if (!window.confirm("Are you sure you want to remove this seller as a hub?")) {
      return
    }
    const currentHubIds = sellers.filter(s => s.isZoneHub).map(s => s._id || s.id)
    const updatedHubIds = currentHubIds.filter(id => id !== sellerId)

    try {
      setSaving(true)
      const response = await adminApi.assignQuickZoneHubs({
        zoneId: selectedZone._id || selectedZone.id,
        sellerIds: updatedHubIds
      })
      if (response.data?.success) {
        setMessage({ type: "success", text: "Seller removed as hub successfully!" })
        fetchSellers(selectedZone._id || selectedZone.id)
      }
    } catch (error) {
      console.error("Error removing hub:", error)
      setMessage({ type: "error", text: "Failed to remove hub." })
    } finally {
      setSaving(false)
    }
  }

  const handleAddHubsSubmit = async (e) => {
    e.preventDefault()
    const currentHubIds = sellers.filter(s => s.isZoneHub).map(s => s._id || s.id)
    const updatedHubIds = [...new Set([...currentHubIds, ...modalSelectedSellerIds])]

    try {
      setSaving(true)
      const response = await adminApi.assignQuickZoneHubs({
        zoneId: selectedZone._id || selectedZone.id,
        sellerIds: updatedHubIds
      })
      if (response.data?.success) {
        setMessage({ type: "success", text: "New hubs created successfully!" })
        setIsAddModalOpen(false)
        setModalSelectedSellerIds([])
        fetchSellers(selectedZone._id || selectedZone.id)
      }
    } catch (error) {
      console.error("Error assigning hubs:", error)
      setMessage({ type: "error", text: "Failed to create hubs." })
    } finally {
      setSaving(false)
    }
  }

  const activeHubs = sellers.filter(s => s.isZoneHub)
  const nonHubSellers = sellers.filter(s => !s.isZoneHub)

  const filteredHubs = activeHubs.filter(s =>
    s.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredModalSellers = nonHubSellers.filter(s =>
    s.shopName?.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
    s.name?.toLowerCase().includes(modalSearchQuery.toLowerCase())
  )

  const toggleModalSeller = (sellerId) => {
    setModalSelectedSellerIds(prev =>
      prev.includes(sellerId) ? prev.filter(id => id !== sellerId) : [...prev, sellerId]
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-md">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Quick Zone Hub Setup</h1>
            <p className="text-sm text-slate-500">Designate Q-Commerce shops as active physical cash collection hubs per zone</p>
          </div>
        </div>

        {/* Global Alert Messages */}
        {message && (
          <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm mb-6 border ${
            message.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
          }`}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-semibold">{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-extrabold">✕</button>
          </div>
        )}

        {/* Main Double-Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Pane: Zones List */}
          <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Operational Zones</h3>
            </div>
            {loadingZones ? (
              <div className="p-8 text-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <p className="text-xs text-slate-400 font-semibold">Loading zones...</p>
              </div>
            ) : zones.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-semibold">No active zones found</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {zones.map((zone) => {
                  const isSelected = selectedZone?._id === zone._id || selectedZone?.id === zone.id
                  return (
                    <div
                      key={zone._id || zone.id}
                      onClick={() => setSelectedZone(zone)}
                      className={`p-4 flex items-center justify-between cursor-pointer transition-all hover:bg-slate-50 ${
                        isSelected ? "bg-red-50/30 border-l-4 border-l-primary font-extrabold" : "border-l-4 border-l-transparent font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-5 h-5 shrink-0 ${isSelected ? "text-primary" : "text-slate-400"}`} />
                        <div>
                          <div className={`text-sm ${isSelected ? "text-slate-900" : "text-slate-700"}`}>
                            {zone.zoneName || zone.name}
                          </div>
                          <span className="text-[10px] text-slate-400 block font-normal mt-0.5 uppercase">ID: {zone._id || zone.id}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Pane: Hubs in selected zone */}
          <div className="lg:col-span-8 space-y-4">
            {selectedZone ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                
                {/* Zone Header info & Create CTA */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">
                      Active Hubs in <span className="text-primary">{selectedZone.zoneName || selectedZone.name}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Sellers assigned to this geofence as physical COD collection points</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setModalSelectedSellerIds([])
                      setModalSearchQuery("")
                      setIsAddModalOpen(true)
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-extrabold shadow transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Hub</span>
                  </button>
                </div>

                {/* Filter and search bar */}
                {activeHubs.length > 0 && (
                  <div className="p-4 border-b border-slate-50 bg-white">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search designated hubs by store name or owner..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Hubs content workspace */}
                {loadingSellers ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                    <p className="text-xs text-slate-400 font-semibold">Fetching zone hubs list...</p>
                  </div>
                ) : filteredHubs.length === 0 ? (
                  <div className="p-16 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-slate-800">No active hubs in this zone</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 max-w-sm mx-auto">
                        {searchQuery ? "Try refining your search query" : "Click 'Create Hub' to assign flagship sellers in this zone as cash collection hubs."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50/30 border-b border-slate-100">
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Store Details</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Owner Info</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredHubs.map((seller) => (
                          <tr key={seller._id || seller.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-extrabold text-slate-800">{seller.shopName || "Unnamed Store"}</div>
                              <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">ID: {seller._id || seller.id}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-xs font-bold text-slate-700">{seller.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{seller.phone || "N/A"}</div>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                seller.isActive !== false ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {seller.isActive !== false ? "Active Store" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => handleRemoveHub(seller._id || seller.id)}
                                disabled={saving}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                title="Remove as hub"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
                <MapPin className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">Select a Zone</h3>
                <p className="text-sm text-slate-500">Choose an operational geofence from the left panel to list its active hubs.</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* CREATE HUB MODAL */}
      {isAddModalOpen && selectedZone && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Create Quick Hub</h3>
                <p className="text-xs text-slate-500 mt-0.5">Designate sellers inside <span className="font-bold text-primary">{selectedZone.zoneName || selectedZone.name}</span> as cash hubs</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              
              {/* Search bar inside modal */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search available non-hub store names..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Sellers Checkbox List */}
              {loadingSellers ? (
                <div className="p-8 text-center space-y-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-xs text-slate-400">Loading sellers in zone...</p>
                </div>
              ) : filteredModalSellers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm font-semibold">
                  {modalSearchQuery ? "No matches for your search" : "No other approved, active Q-Commerce sellers are available in this zone."}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                  {filteredModalSellers.map((seller) => {
                    const isChecked = modalSelectedSellerIds.includes(seller._id || seller.id)
                    return (
                      <div
                        key={seller._id || seller.id}
                        onClick={() => toggleModalSeller(seller._id || seller.id)}
                        className={`p-3.5 flex items-center gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors ${
                          isChecked ? "bg-red-50/15" : ""
                        }`}
                      >
                        <div className={`w-5.5 h-5.5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isChecked ? "bg-primary border-primary" : "border-slate-300 bg-white"
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{seller.shopName || "Unnamed Store"}</div>
                          <p className="text-xs text-slate-400 mt-0.5 font-medium">Owner: {seller.name || "N/A"}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-150 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg py-2.5 px-4 text-slate-700 bg-white font-semibold border border-slate-350 hover:bg-slate-50 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleAddHubsSubmit}
                disabled={saving || modalSelectedSellerIds.length === 0}
                className="rounded-lg py-2.5 px-5 font-bold bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors shadow-sm"
              >
                {saving ? "Creating Hubs..." : `Assign as Hubs (${modalSelectedSellerIds.length})`}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
