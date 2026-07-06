import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  Plus, Search, MapPin, Trash2, Pencil, Eye, Map, Users, Truck, Package, X, Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import porterAdminApi from "../services/adminApi";
import { findZoneOverlapMessage } from "../../../../shared/utils/zoneOverlap";
import { GoogleMap, useJsApiLoader, Polygon, Marker } from "@react-google-maps/api";

const libraries = ["places"];
const mapContainerStyle = { width: "100%", height: "100%", borderRadius: "0.5rem" };
const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India center

const orderPointsRadially = (pts) => {
  const points = pts
    .map(p => ({
      lat: typeof p.lat === 'function' ? p.lat() : p.lat,
      lng: typeof p.lng === 'function' ? p.lng() : p.lng,
    }))
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');

  if (points.length < 3) return points;

  const cx = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.lat, 0) / points.length;

  return [...points].sort((a, b) =>
    Math.atan2(a.lat - cy, a.lng - cx) - Math.atan2(b.lat - cy, b.lng - cx)
  );
};

const EMPTY_ZONE = {
  name: "", country: "India", unit: "kilometer", status: "active",
  coordinates: []
};

const Zones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY_ZONE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Map state
  const [isDrawing, setIsDrawing] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(5);
  const mapRef = useRef(null);
  const previewMapRef = useRef(null);
  const detailMapRef = useRef(null);

  useEffect(() => {
    if (!previewMapRef.current || !window.google) return;
    const activeZones = zones.filter(z => z.status === 'active' && z.coordinates?.length > 2);
    if (activeZones.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      activeZones.forEach(z => z.coordinates.forEach(c => bounds.extend(c)));
      previewMapRef.current.fitBounds(bounds, 40);
    } else {
      previewMapRef.current.setCenter(defaultCenter);
      previewMapRef.current.setZoom(5);
    }
  }, [zones]);

  useEffect(() => {
    if (!detailMapRef.current || !window.google || !detail) return;
    if (detail.coordinates?.length > 2) {
      const bounds = new window.google.maps.LatLngBounds();
      detail.coordinates.forEach(c => bounds.extend(c));
      detailMapRef.current.fitBounds(bounds, 40);
    }
  }, [detail]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const countries = useMemo(() => [...new Set(zones.map((z) => z.country).filter(Boolean))], [zones]);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const result = await porterAdminApi.getZones({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        country: countryFilter !== "all" ? countryFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        sortBy: "name",
        sortOrder: "asc",
      });
      setZones(result.records || []);
      setTotal(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, countryFilter, statusFilter]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const pageItems = zones;

  const openForm = (row = null) => {
    setEditing(row);
    setForm(row ? {
      ...row,
      coordinates: row.coordinates || []
    } : EMPTY_ZONE);
    
    if (row && row.coordinates && row.coordinates.length > 0) {
      setMapCenter(row.coordinates[0]);
      setMapZoom(12);
    } else {
      setMapCenter(defaultCenter);
      setMapZoom(5);
    }
    
    setErrors({});
    setIsDrawing(false);
    setFormOpen(true);
  };

  const openDetail = (row) => {
    setDetail(row);
    setDetailOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Zone name required";
    if (!form.country.trim()) e.country = "Country required";
    if (!form.coordinates || form.coordinates.length < 3) e.coordinates = "Draw a polygon with at least 3 points";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const overlapMessage = findZoneOverlapMessage(
      form.coordinates,
      zones,
      editing?.id || null
    );
    if (overlapMessage) {
      setErrors({ coordinates: overlapMessage });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        country: form.country,
        unit: form.unit,
        status: form.status,
        coordinates: form.coordinates,
      };
      if (editing?.id) {
        await porterAdminApi.updateZone(editing.id, payload);
        toast.success("Zone updated successfully");
      } else {
        await porterAdminApi.createZone(payload);
        toast.success("Zone created successfully");
      }
      setFormOpen(false);
      fetchZones();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save zone");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await porterAdminApi.deleteZone(deleteTarget.id);
      toast.success("Zone deleted");
      setDeleteTarget(null);
      fetchZones();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete zone");
    }
  };

  const handleMapClick = useCallback((e) => {
    if (!isDrawing) return;
    if (form.coordinates?.length >= 10) {
      toast.error("You can add at most 10 points.");
      return;
    }
    const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    const newCoords = orderPointsRadially([...(form.coordinates || []), newPoint]);
    setForm((prev) => ({ ...prev, coordinates: newCoords }));
  }, [isDrawing, form.coordinates]);

  const clearDrawing = () => {
    setForm((prev) => ({ ...prev, coordinates: [] }));
    setIsDrawing(true);
  };

  const columns = [
    { 
      key: "name", 
      header: "Zone", 
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{row.name}</span>
          <span className="text-xs text-gray-500 font-mono mt-0.5">{row.zoneCode}</span>
        </div>
      )
    },
    { key: "country", header: "Country" },
    { key: "orders", header: "Orders", cell: (row) => String(row.orders || 0) },
    { key: "drivers", header: "Drivers", cell: (row) => String(row.drivers || 0) },
    { key: "vehicles", header: "Vehicles", cell: (row) => String(row.vehicles || 0) },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => openForm(row)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(row)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  const selectCls = "w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Zone Management"
        description="Define service areas, coverage polygons and operational boundaries"
        actions={<Button onClick={() => openForm()} className="gap-2"><Plus size={16} /> Add Zone</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Zones" value={String(zones.length)} icon={<MapPin size={18} />} />
        <StatCard title="Active Zones" value={String(zones.filter((z) => z.status === "active").length)} />
        <StatCard title="Total Orders" value={String(zones.reduce((a, z) => a + (Number(z.orders) || 0), 0))} icon={<Package size={18} />} />
        <StatCard title="Fleet Coverage" value={String(zones.reduce((a, z) => a + (Number(z.vehicles) || 0), 0))} icon={<Truck size={18} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard flush>
            <div className="p-4 space-y-4">
              <FilterBar
                start={
                  <>
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Search zones..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                    <select className={selectCls + " w-auto"} value={countryFilter} onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}>
                      <option value="all">All Countries</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className={selectCls + " w-auto"} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </>
                }
              />
              <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id} loading={loading}
                pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Zone Map Preview" subtitle="Visualizing active zones">
          <div className="relative h-[400px] rounded-xl border overflow-hidden">
            {!isLoaded ? (
              <div className="flex items-center justify-center h-full bg-slate-50"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>
            ) : loadError ? (
              <div className="flex items-center justify-center h-full bg-red-50 text-red-500 text-sm">Failed to load Map</div>
            ) : (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={defaultCenter}
                zoom={5}
                options={{ disableDefaultUI: true }}
                onLoad={(map) => {
                  previewMapRef.current = map;
                }}
              >
                {zones.filter(z => z.status === 'active' && z.coordinates && z.coordinates.length > 2).map((zone, i) => (
                  <Polygon
                    key={zone.id || i}
                    path={zone.coordinates}
                    options={{
                      fillColor: "#3b82f6",
                      fillOpacity: 0.2,
                      strokeColor: "#2563eb",
                      strokeWeight: 2,
                    }}
                  />
                ))}
              </GoogleMap>
            )}
          </div>
          {pageItems[0] && (
            <div className="mt-4 rounded-lg border p-3 text-sm">
              <p className="font-semibold">{pageItems[0].name}</p>
              <p className="text-muted-foreground text-xs mt-1">{pageItems[0].polygon}</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ADD/EDIT ZONE MODAL */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[900px] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{editing ? "Edit Zone" : "Add Zone"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Form Side */}
            <div className="h-[460px] overflow-y-auto pr-2">
              <FormLayout>
                <FormSection>
                  <FormRow>
                    <FormField label="Create Zone name" required error={errors.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter zone name" /></FormField>
                    <FormField label="Country" required error={errors.country}>
                      <select className={selectCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                        <option value="India">India</option>
                        {/* Add more countries if needed */}
                      </select>
                    </FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="Select Unit">
                      <select className={selectCls} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                        <option value="kilometer">Kilometers (km)</option>
                        <option value="mile">Miles (mi)</option>
                      </select>
                    </FormField>
                  <FormField label="Status">
                    <select className={selectCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </FormField>
                  </FormRow>
                  {errors.coordinates && (
                    <p className="text-red-500 text-sm mt-2">{errors.coordinates}</p>
                  )}
                </FormSection>
              </FormLayout>
            </div>

            {/* Map Side */}
            <div className="flex flex-col h-[460px]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">Zone Area Map</h4>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearDrawing}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    Clear Map
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setIsDrawing(!isDrawing)}
                    className={isDrawing ? "bg-amber-500 hover:bg-amber-600" : ""}
                  >
                    {isDrawing ? "Stop Drawing" : "Start Drawing"}
                  </Button>
                </div>
              </div>
              
              <div className="relative flex-1 rounded-xl border border-gray-200 overflow-hidden shadow-inner">
                {!isLoaded ? (
                  <div className="flex items-center justify-center h-full bg-slate-50"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>
                ) : loadError ? (
                  <div className="flex items-center justify-center h-full bg-red-50 text-red-500 text-sm">Failed to load Map</div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={mapCenter}
                    zoom={mapZoom}
                    onClick={handleMapClick}
                    onLoad={(map) => { mapRef.current = map; }}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                      draggableCursor: isDrawing ? 'crosshair' : 'grab'
                    }}
                  >
                    {form.coordinates && form.coordinates.length > 2 && (
                      <Polygon
                        path={form.coordinates}
                        options={{
                          fillColor: "#10b981",
                          fillOpacity: 0.35,
                          strokeColor: "#059669",
                          strokeWeight: 2,
                        }}
                      />
                    )}
                    {isDrawing && form.coordinates && form.coordinates.map((coord, i) => (
                      <Marker key={i} position={coord} icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' }} />
                    ))}
                  </GoogleMap>
                )}
                
                {isDrawing && (
                  <div className="absolute top-4 left-4 right-14 bg-white/90 backdrop-blur shadow-sm rounded-lg p-2 text-xs font-medium text-emerald-800 border border-emerald-100 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Click on the map to place boundary points.
                  </div>
                )}
              </div>
            </div>

          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2 bg-slate-50/50">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Saving...</> : "Save Zone"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETAIL MODAL */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[520px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>Zone Details</DialogTitle></DialogHeader>
          <div className="px-6 py-4 max-h-[85vh] overflow-y-auto">
            {detail && (
              <FormLayout>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-gray-900">{detail.name}</h3>
                  <StatusBadge status={detail.status} />
                </div>
                
                <FormSection title="Zone Info">
                  <FormRow>
                    <FormField label="Country"><div className="text-sm font-medium">{detail.country}</div></FormField>
                    <FormField label="Unit"><div className="text-sm font-medium capitalize">{detail.unit}</div></FormField>
                  </FormRow>
                </FormSection>

                <FormSection title="Metrics">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <Package size={16} className="mx-auto text-primary" />
                      <p className="text-lg font-bold mt-1">{detail.orders || 0}</p>
                      <p className="text-xs text-muted-foreground">Orders</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <Users size={16} className="mx-auto text-blue-600" />
                      <p className="text-lg font-bold mt-1">{detail.drivers || 0}</p>
                      <p className="text-xs text-muted-foreground">Drivers</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <Truck size={16} className="mx-auto text-emerald-600" />
                      <p className="text-lg font-bold mt-1">{detail.vehicles || 0}</p>
                      <p className="text-xs text-muted-foreground">Vehicles</p>
                    </div>
                  </div>
                </FormSection>
                
                <FormSection title="Map">
                  <div className="h-48 rounded-lg border overflow-hidden">
                    {!isLoaded ? (
                      <div className="flex items-center justify-center h-full bg-slate-50"><Loader2 className="animate-spin text-primary w-6 h-6"/></div>
                    ) : (
                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={defaultCenter}
                        zoom={5}
                        options={{ disableDefaultUI: true, gestureHandling: 'none' }}
                        onLoad={(map) => {
                          detailMapRef.current = map;
                          if (detail.coordinates?.length > 2) {
                            const bounds = new window.google.maps.LatLngBounds();
                            detail.coordinates.forEach(c => bounds.extend(c));
                            map.fitBounds(bounds, 40);
                          }
                        }}
                      >
                        {detail.coordinates && detail.coordinates.length > 2 && (
                          <Polygon
                            path={detail.coordinates}
                            options={{
                              fillColor: "#3b82f6",
                              fillOpacity: 0.35,
                              strokeColor: "#2563eb",
                              strokeWeight: 2,
                            }}
                          />
                        )}
                      </GoogleMap>
                    )}
                  </div>
                </FormSection>
              </FormLayout>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="blaze-theme-scope sm:max-w-[425px] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-red-600">Delete Zone</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete the zone <strong className="text-gray-900">{deleteTarget?.name}</strong>? 
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete Zone</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Zones;
