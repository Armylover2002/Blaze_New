import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Search, Truck, Trash2, ChevronLeft, ChevronRight, 
  Bike, Car, Bus, Plane, Ship, Zap, Navigation, Warehouse, Box, Ambulance, Tractor, Train,
  Upload, ChevronDown
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
  EmptyState, TableSkeleton,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { usePorterVehicles, DEFAULT_VEHICLE_PRICING } from "../utils/vehicleStore";
import { getIconComponent, ICONS_DICTIONARY } from "../utils/VehicleIcons";
const VEHICLE_CATEGORIES = [
  "Bike", "EV Bike", "Bicycle", "Scooter", "Auto Rickshaw", "Pickup", "Tata Ace", "Mini Truck", 
  "Truck", "Heavy Truck", "Tempo", "Tempo Traveller", "Cargo Van", "Van", "EV Van", 
  "Mini Bus", "Bus", "Ambulance", "Tractor", "Dumper", "Trailer", "Crane", "Water Tanker", 
  "Refrigerated Truck", "Other"
];

const EMPTY_FORM = {
  name: "", 
  category: "", 
  icon: "Truck",
  description: "", 
  minWeight: "", 
  maxWeight: "", 
  status: "active"
};

const Vehicles = () => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = usePorterVehicles();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

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

  const handleOpenModal = (vehicle = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        ...EMPTY_FORM,
        ...vehicle,
        icon: vehicle.icon || "Truck",
        supportedGoods: vehicle.supportedGoods || []
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
    setFormData(prev => ({
      ...prev,
      category: cat,
      icon: getSuggestedIcon(cat)
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
        alert("Please fix the validation errors before saving.");
        return;
    }
    
    const payload = {
        ...formData,
        minWeight: Number(formData.minWeight),
        maxWeight: Number(formData.maxWeight),
    };

    if (editingVehicle) {
      setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? { ...v, ...payload } : v));
    } else {
      const newVehicle = {
        id: `VH${String(vehicles.length + 1).padStart(3, '0')}`,
        assignedDrivers: 0,
        count: 0,
        ...DEFAULT_VEHICLE_PRICING,
        pricingConfigured: false,
        ...payload
      };
      setVehicles(prev => [newVehicle, ...prev]);
    }
    handleCloseModal();
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
        setVehicles(prev => prev.filter(v => v.id !== id));
    }
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            v.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (v.id && v.id.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === "all" || v.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || v.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [vehicles, searchTerm, statusFilter, categoryFilter]);

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const currentVehicles = filteredVehicles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableColumns = [
    {
      header: "Icon",
      key: "icon",
      cell: (row) => {
        const IconComp = getIconComponent(row.icon);
        return (
          <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center p-1 drop-shadow-sm">
            <IconComp />
          </div>
        );
      },
    },
    { header: "Vehicle Name", key: "name", className: "font-semibold text-gray-900" },
    { header: "Category", key: "category", cell: (row) => <span className="font-medium text-gray-700">{row.category}</span> },
    { header: "Min Weight", key: "minWeight", cell: (row) => <span>{row.minWeight} kg</span> },
    { header: "Max Weight", key: "maxWeight", cell: (row) => <span>{row.maxWeight} kg</span> },

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
        <StatCard title="Active Models" value={vehicles.filter(v => v.status === "active").length.toString()} subtitle={`Out of ${vehicles.length} total models`} icon={<Truck size={20} />} iconBg="bg-green-100 text-green-600" />
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
            <AdminTable columns={tableColumns} data={currentVehicles} />
            
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <span className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * itemsPerPage, filteredVehicles.length)}</span> of <span className="font-medium text-gray-900">{filteredVehicles.length}</span> results
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
                <FormRow>
                  <div className="flex flex-col sm:flex-row items-start gap-8 w-full py-2">
                    <div className="w-64 shrink-0 flex flex-col gap-2">
                      <div className="relative w-full h-48 rounded-xl border border-gray-200 overflow-hidden bg-[#e5e3df] flex items-center justify-center shadow-inner">
                        <div className="absolute inset-0 opacity-20" style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                        }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                           <div className="w-16 h-16 drop-shadow-xl bg-white p-2 rounded-full border-2 border-white flex items-center justify-center relative z-10">
                             <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r-2 border-b-2 border-transparent z-[-1] drop-shadow-sm"></div>
                             {(() => {
                               const IconComp = getIconComponent(formData.icon);
                               return <IconComp className="w-full h-full" />;
                             })()}
                           </div>
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-white/80 backdrop-blur-sm rounded text-[10px] font-bold text-gray-500 uppercase tracking-wide">Live Preview</div>
                      </div>
                      {errors.icon && <p className="text-xs text-red-500 font-medium">{errors.icon}</p>}
                    </div>

                    <div className="flex-1 flex flex-col justify-center pt-8">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Live Map Icon <span className="text-red-500">*</span></h4>
                        <p className="text-xs text-gray-500 mb-6 leading-relaxed">Select a colorful logistics vehicle illustration. This icon will represent the vehicle on the live tracking map and active order screens.</p>
                        <Button type="button" variant="outline" onClick={() => setIsIconPickerOpen(true)} className="w-fit gap-2">
                          <Search size={16} />
                          Change Map Icon
                        </Button>
                    </div>
                  </div>
                </FormRow>

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
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">Vehicle Icon <span className="text-red-500">*</span></h4>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center shadow-sm p-1">
                        {(() => {
                           const IconComp = getIconComponent(formData.icon);
                           return <IconComp className="w-full h-full" />;
                        })()}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIsIconPickerOpen(true)}>Change Icon</Button>
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

      {/* Icon Picker Popup */}
      <Dialog open={isIconPickerOpen} onOpenChange={setIsIconPickerOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-3xl bg-gray-50 p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-white shadow-sm z-10 relative">
            <DialogTitle className="text-lg font-bold text-gray-900">Select Vehicle Icon</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">Choose a vibrant icon for live tracking visualization.</p>
          </DialogHeader>
          
          <div className="px-6 py-4 bg-white border-b border-gray-100">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search icons (e.g. Truck, Van)..." 
                value={iconSearch} 
                onChange={(e) => setIconSearch(e.target.value)} 
                className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-red-500"
                autoFocus
              />
            </div>
          </div>
            
          <div className="p-6 max-h-[50vh] overflow-y-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {Object.keys(ICONS_DICTIONARY)
                .filter(name => name.toLowerCase().includes(iconSearch.toLowerCase()))
                .map(iconName => {
                  const IconComp = ICONS_DICTIONARY[iconName];
                  const isSelected = formData.icon === iconName;
                  return (
                    <div 
                      key={iconName}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, icon: iconName }));
                        setIsIconPickerOpen(false);
                      }}
                      className={`cursor-pointer flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                        isSelected 
                          ? 'border-red-500 bg-red-50 shadow-md ring-4 ring-red-500/10' 
                          : 'border-white hover:border-gray-200 hover:shadow-sm bg-white shadow-sm'
                      }`}
                    >
                      <div className="w-14 h-14 drop-shadow-sm">
                        <IconComp />
                      </div>
                      <span className={`text-[11px] font-medium text-center leading-tight ${isSelected ? 'text-red-700' : 'text-gray-600'}`}>{iconName}</span>
                    </div>
                  );
              })}
            </div>
          </div>
          <div className="flex justify-end p-4 border-t border-gray-200 bg-white">
            <Button variant="outline" onClick={() => setIsIconPickerOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vehicles;
