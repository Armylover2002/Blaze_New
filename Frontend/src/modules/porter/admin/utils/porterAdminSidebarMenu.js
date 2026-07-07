export const porterAdminSidebarMenu = [
  {
    type: "section",
    title: "Main Menu",
    items: [
      {
        type: "link",
        label: "Dashboard",
        icon: "LayoutDashboard",
        path: "/admin/porter/dashboard",
        permissionKey: "dashboard",
      },
    ],
  },
  {
    type: "section",
    title: "Logistics Management",
    items: [
      {
        type: "link",
        label: "Orders",
        icon: "Package",
        path: "/admin/porter/orders",
        permissionKey: "orders",
      },

      {
        type: "link",
        label: "Vehicles",
        icon: "Truck",
        path: "/admin/porter/vehicles",
        permissionKey: "vehicles",
      },

      {
        type: "link",
        label: "Zones",
        icon: "MapPin",
        path: "/admin/porter/zones",
        permissionKey: "zones",
      },
      {
        type: "link",
        label: "Customers",
        icon: "Users",
        path: "/admin/porter/users",
        permissionKey: "users",
      },
    ],
  },
  {
    type: "section",
    title: "Finance",
    items: [
      {
        type: "link",
        label: "Pricing & Commission",
        icon: "IndianRupee",
        path: "/admin/porter/pricing",
        permissionKey: "pricing",
      },
      {
        type: "link",
        label: "Coupons & Offers",
        icon: "Gift",
        path: "/admin/porter/coupons",
        permissionKey: "coupons",
      },
      {
        type: "link",
        label: "Wallet",
        icon: "Wallet",
        path: "/admin/porter/wallet",
        permissionKey: "wallet",
      },
      {
        type: "link",
        label: "Transactions",
        icon: "Receipt",
        path: "/admin/porter/transactions",
        permissionKey: "transactions",
      },
    ],
  },
  {
    type: "section",
    title: "Insights",
    items: [
      {
        type: "link",
        label: "Reports & Analytics",
        icon: "FileText",
        path: "/admin/porter/reports",
        permissionKey: "reports",
      },

    ],
  },

  {
    type: "section",
    title: "Configuration",
    items: [
      {
        type: "link",
        label: "Banners",
        icon: "Image",
        path: "/admin/porter/banners",
        permissionKey: "banners",
      },
    ],
  },
];
