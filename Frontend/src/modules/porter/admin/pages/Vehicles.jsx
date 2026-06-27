import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Plus, Search, Truck, Trash2, ChevronLeft, ChevronRight, 
  Bike, Car, Bus, Plane, Ship, Zap, Navigation, Warehouse, Box, Ambulance, Tractor, Train,
  Upload, ChevronDown, Utensils, ShoppingCart, CheckCircle2
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
  EmptyState, TableSkeleton,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

import porterAdminApi from "../services/adminApi";
import { getIconComponent, ICONS_DICTIONARY } from "../utils/VehicleIcons";
const VEHICLE_CATEGORIES = [
  "Bike", "EV Bike", "Bicycle", "Scooter", "Auto Rickshaw", "Pickup", "Tata Ace", "Mini Truck", 
  "Truck", "Heavy Truck", "Tempo", "Tempo Traveller", "Cargo Van", "Van", "EV Van", 
  "Mini Bus", "Bus", "Ambulance", "Tractor", "Dumper", "Trailer", "Crane", "Water Tanker", 
  "Refrigerated Truck", "Other"
];

const SERVICES_MAP = {
  food: { name: "Food Delivery", desc: "Deliver restaurant orders", icon: Utensils, color: "text-orange-500", bg: "bg-orange-50" },
  quick: { name: "Quick Commerce", desc: "Deliver groceries & instant items", icon: ShoppingCart, color: "text-purple-500", bg: "bg-purple-50" },
  parcel: { name: "Porter Parcel", desc: "Deliver parcels & heavy goods", icon: Box, color: "text-blue-500", bg: "bg-blue-50" },
};

const EMPTY_FORM = {
  name: "", 
  category: "", 
  icon: "Truck",
  description: "", 
  minWeight: "", 
  maxWeight: "", 
  status: "active",
  supportedServices: []
};

const Vehicles = () => {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [iconFile, setIconFile] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await porterAdminApi.getVehicles({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        sortBy: "displayOrder",
        sortOrder: "asc",
      });
      setVehicles(result.records || []);
      setTotal(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleOpenModal = (vehicle = null) => {
    setIconFile(null);
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        ...EMPTY_FORM,
        ...vehicle,
        icon: vehicle.icon || "Truck",
        supportedGoods: vehicle.supportedGoods || [],
        supportedServices: vehicle.supportedServices || []
      });
    } else {
      setEditingVehicle(null);
      setFormData(EMPTY_FORM);
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const getSuggestedIcon = (cat) => {
    return ICONS_DICTIONARY[cat] ? cat : "Truck";
  };

  const handleCategorySelect = (cat) => {
    let suggestedServices = ["parcel"];
    if (["Bike", "EV Bike", "Scooter", "Bicycle"].includes(cat)) {
       suggestedServices = ["food", "quick", "parcel"];
    } else if (["Bus", "Mini Bus", "Other"].includes(cat)) {
       suggestedServices = [];
    }

    setFormData(prev => ({
      ...prev,
      category: cat,
      icon: getSuggestedIcon(cat),
      supportedServices: prev.category === "" ? suggestedServices : prev.supportedServices
    }));
    setIsCategoryOpen(false);
    setCategorySearch("");
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Vehicle Name is required";
    if (!formData.category.trim()) newErrors.category = "Vehicle Category is required";
    if (!formData.icon) newErrors.icon = "Vehicle Icon is required";
    if (formData.minWeight === "" || Number(formData.minWeight) < 0) newErrors.minWeight = "Min weight must be >= 0";
    if (formData.maxWeight === "" || Number(formData.maxWeight) <= Number(formData.minWeight)) newErrors.maxWeight = "Max weight must be greater than min weight";
    if (!formData.supportedServices || formData.supportedServices.length === 0) newErrors.supportedServices = "At least one Supported Service is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
        toast.error("Please fix the validation errors before saving.");
        return;
    }
    
    const payload = {
        ...formData,
        minWeight: Number(formData.minWeight),
        maxWeight: Number(formData.maxWeight),
        supportedServices: formData.supportedServices || [],
    };

    try {
      if (editingVehicle?.id) {
        await porterAdminApi.updateVehicle(editingVehicle.id, payload, iconFile);
        toast.success("Vehicle updated successfully");
      } else {
        await porterAdminApi.createVehicle(payload, iconFile);
        toast.success("Vehicle created successfully");
      }
      handleCloseModal();
      fetchVehicles();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save vehicle");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this vehicle?")) return;
    try {
      await porterAdminApi.deleteVehicle(id);
      toast.success("Vehicle deleted");
      fetchVehicles();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete vehicle");
    }
  };

  const currentVehicles = vehicles;

  const tableColumns = [
    {
      header: "Icon",
      key: "icon",
      cell: (row) => {
        const isSvgData = row.icon?.startsWith('data:image/svg+xml') || row.icon?.startsWith('http') || row.iconUrl;
        const iconSrc = row.iconUrl || row.icon;
        const IconComp = !isSvgData ? getIconComponent(row.icon) : null;
        return (
          <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center p-1 drop-shadow-sm overflow-hidden">
            {isSvgData ? (
               <img src={iconSrc} alt={row.name} className="w-full h-full object-contain" />
            ) : (
               <IconComp className="w-full h-full text-gray-500" />
            )}
          </div>
        );
      },
    },
    { header: "Vehicle Name", key: "name", className: "font-semibold text-gray-900" },
    { header: "Category", key: "category", cell: (row) => <span className="font-medium text-gray-700">{row.category}</span> },
    { header: "Min Weight", key: "minWeight", cell: (row) => <span>{row.minWeight} kg</span> },
    { header: "Max Weight", key: "maxWeight", cell: (row) => <span>{row.maxWeight} kg</span> },
    { 
      header: "Supported Services", 
      key: "supportedServices", 
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.supportedServices?.map(svc => {
            const sInfo = SERVICES_MAP[svc];
            if (!sInfo) return null;
            return (
              <span key={svc} className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${sInfo.bg} ${sInfo.color} border-${sInfo.color.replace('text-', '')}/20`}>
                {sInfo.name.split(' ')[0]}
              </span>
            );
          })}
        </div>
      ) 
    },
    { header: "Status", key: "status", cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: "Actions",
      key: "actions",
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(row)}>Edit</Button>
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}>
              <Trash2 size={16} />
            </Button>
        </div>
      ),
    },
  ];


  const filteredCategories = VEHICLE_CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));

  return (
    <div className="blaze-theme-scope space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Vehicle & Fleet Management"
        subtitle="Manage logistics models, capacities, pricing and commissions"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Porter", href: "/admin/porter" },
          { label: "Vehicles" },
        ]}
        actions={
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus size={16} />
            Add Vehicle
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Fleet Size" value={vehicles.reduce((acc, v) => acc + (v.count || 1), 0).toString()} trend="up" trendValue="+12" subtitle="Across all models" icon={<Truck size={20} />} iconBg="bg-blue-100 text-blue-600" />
        <StatCard title="Active Models" value={vehicles.filter(v => v.status === "active").length.toString()} subtitle={`Out of ${total} total models`} icon={<Truck size={20} />} iconBg="bg-green-100 text-green-600" />
        <StatCard title="Assigned Drivers" value={vehicles.reduce((acc, v) => acc + (v.assignedDrivers || 0), 0).toString()} subtitle="Currently driving" icon={<Truck size={20} />} iconBg="bg-purple-100 text-purple-600" />
      </div>

      <SectionCard>
        <FilterBar
          searchPlaceholder="Search name, category or ID..."
          searchValue={searchTerm}
          onSearchChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
          filters={[
            {
              id: "status",
              value: statusFilter,
              onChange: (val) => { setStatusFilter(val); setCurrentPage(1); },
              options: [
                { label: "All Status", value: "all" },
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ],
            },
            {
              id: "category",
              value: categoryFilter,
              onChange: (val) => { setCategoryFilter(val); setCurrentPage(1); },
              options: [
                { label: "All Categories", value: "all" },
                ...Array.from(new Set(vehicles.map(v => v.category))).map(t => ({ label: t, value: t }))
              ],
            }
          ]}
        />

        {loading ? (
          <TableSkeleton rows={5} columns={8} />
        ) : currentVehicles.length > 0 ? (
          <div className="overflow-x-auto pb-4">
            <AdminTable columns={tableColumns} data={currentVehicles} loading={loading} />
            
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <span className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * itemsPerPage, total)}</span> of <span className="font-medium text-gray-900">{total}</span> results
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                  <ChevronLeft size={16} className="mr-1" /> Prev
                </Button>
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${currentPage === i + 1 ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                  Next <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Truck}
            title="No vehicles found"
            description={searchTerm || statusFilter !== "all" || categoryFilter !== "all" ? "Try adjusting your search or filters." : "Get started by adding a new vehicle to your logistics fleet."}
            action={{ label: "Add Vehicle", onClick: () => handleOpenModal() }}
          />
        )}
      </SectionCard>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[900px] p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-6 overflow-y-auto flex-1">
            <FormLayout>
              <FormSection title="Basic Information" description="Core details of the vehicle">


                <FormRow cols={2}>
                  <FormField label="Vehicle Name" required error={errors.name}>
                    <Input placeholder="e.g. Tata Ace" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </FormField>
                  
                  <FormField label="Vehicle Category" required error={errors.category}>
                    <div className="relative" ref={categoryRef}>
                      <div 
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center justify-between cursor-pointer focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10 transition-all"
                        onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                      >
                        <span className={formData.category ? "text-gray-900" : "text-gray-400"}>
                          {formData.category || "Select Category..."}
                        </span>
                        <ChevronDown size={16} className="text-gray-400" />
                      </div>
                      {isCategoryOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input 
                                placeholder="Search category..." 
                                value={categorySearch} 
                                onChange={(e) => setCategorySearch(e.target.value)}
                                className="pl-8 h-8 text-sm"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-1">
                            {filteredCategories.map(cat => {
                              const CatIcon = getIconComponent(getSuggestedIcon(cat));
                              return (
                                <div 
                                  key={cat} 
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer rounded-md"
                                  onClick={() => handleCategorySelect(cat)}
                                >
                                  <div className="w-4 h-4 text-gray-400">
                                    <CatIcon />
                                  </div>
                                  {cat}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </FormField>
                </FormRow>

                <FormRow cols={2}>
                  <div className="flex flex-col">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">Vehicle Icon (SVG) <span className="text-red-500">*</span></h4>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center shadow-sm p-1 overflow-hidden">
                        {(() => {
                          const isSvgData = formData.icon?.startsWith('data:image/svg+xml') || formData.icon?.startsWith('http');
                          if (isSvgData) {
                            return <img src={formData.icon} alt="Vehicle Icon" className="w-full h-full object-contain" />;
                          }
                          const IconComp = getIconComponent(formData.icon);
                          return <IconComp className="w-full h-full text-gray-400" />;
                        })()}
                      </div>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".svg" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && file.type.includes("svg")) {
                              setIconFile(file);
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setFormData({ ...formData, icon: ev.target.result });
                              };
                              reader.readAsDataURL(file);
                            } else if (file) {
                              alert("Please upload a valid SVG file.");
                            }
                          }}
                        />
                        <Button variant="outline" size="sm" type="button">Upload SVG</Button>
                      </div>
                    </div>
                    {errors.icon && <p className="text-xs text-red-500 font-medium mt-1">{errors.icon}</p>}
                  </div>

                  <FormField label="Status">
                    <select className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </FormField>
                </FormRow>
                
                <FormRow>
                  <FormField label="Description">
                    <textarea 
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all resize-y min-h-[80px]" 
                      placeholder="Brief description..." 
                      value={formData.description} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                    />
                  </FormField>
                </FormRow>
              </FormSection>

              <FormSection title="Weight Configuration" description="Orders whose weight falls between the minimum and maximum values can be assigned to this vehicle.">
                <FormRow cols={2}>
                  <FormField label="Minimum Weight (KG)" required error={errors.minWeight}>
                    <Input type="number" placeholder="0" value={formData.minWeight} onChange={(e) => setFormData({ ...formData, minWeight: e.target.value })} />
                  </FormField>
                  <FormField label="Maximum Weight (KG)" required error={errors.maxWeight}>
                    <Input type="number" placeholder="0" value={formData.maxWeight} onChange={(e) => setFormData({ ...formData, maxWeight: e.target.value })} />
                  </FormField>
                </FormRow>
              </FormSection>

              <FormSection title="Supported Services" description="Select the delivery services this vehicle can perform.">
                <FormRow>
                  <div className="flex flex-col gap-5 w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(SERVICES_MAP).map(([key, info]) => {
                        const isSelected = formData.supportedServices?.includes(key);
                        const IconComponent = info.icon;
                        return (
                          <div 
                            key={key} 
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                supportedServices: isSelected 
                                  ? (prev.supportedServices || []).filter(s => s !== key)
                                  : [...(prev.supportedServices || []), key]
                              }));
                            }}
                            className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 flex flex-col gap-3 group ${
                              isSelected 
                                ? 'border-red-500 bg-red-50/30 shadow-sm' 
                                : 'border-gray-200 bg-white hover:border-red-200 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? info.bg : 'bg-gray-100 group-hover:bg-gray-50'}`}>
                                <IconComponent className={`w-5 h-5 ${isSelected ? info.color : 'text-gray-500'}`} />
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                              </div>
                            </div>
                            <div>
                              <h4 className={`text-sm font-bold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{info.name}</h4>
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{info.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {errors.supportedServices && <p className="text-xs text-red-500 font-medium">{errors.supportedServices}</p>}
                    
                    <div className="mt-2 bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Administrator Guidance
                      </div>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        Vehicle configuration determines which delivery modules become available to Delivery Partners.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                        <div className="bg-white/60 p-2.5 rounded-lg border border-blue-200/50">
                          <span className="text-xs font-bold text-gray-900 block mb-1">Bike / Scooter</span>
                          <span className="text-xs text-gray-600">Food Delivery, Quick Commerce, Porter Parcel</span>
                        </div>
                        <div className="bg-white/60 p-2.5 rounded-lg border border-blue-200/50">
                          <span className="text-xs font-bold text-gray-900 block mb-1">Mini Truck / Tempo</span>
                          <span className="text-xs text-gray-600">Porter Parcel Only</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </FormRow>
              </FormSection>



            </FormLayout>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingVehicle ? "Save Changes" : "Create Vehicle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default Vehicles;
