const admins = ["Super Admin", "Ops Manager", "Finance Admin", "Support Lead", "Zone Admin"];
const roles = ["ADMIN", "OPERATIONS", "FINANCE", "SUPPORT", "ZONE_MANAGER"];
const modules = ["Orders", "Drivers", "Wallet", "Pricing", "Zones", "Users", "Support", "Banners", "Documents", "Settings"];
const actions = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT", "LOGIN", "ASSIGN", "ESCALATE", "PAYOUT"];
const severities = ["info", "success", "warning", "danger"];
const browsers = ["Chrome 124", "Firefox 125", "Edge 122", "Safari 17"];

const descriptions = {
  CREATE: "Created a new record in the module.",
  UPDATE: "Updated configuration or entity details.",
  DELETE: "Removed an entity from the system.",
  APPROVE: "Approved a pending verification request.",
  REJECT: "Rejected a submission with remarks.",
  EXPORT: "Exported data for compliance reporting.",
  LOGIN: "Admin signed into the Porter console.",
  ASSIGN: "Assigned resource to an active workflow.",
  ESCALATE: "Escalated issue to senior operations team.",
  PAYOUT: "Processed driver wallet settlement.",
};

function makeLog(i) {
  const action = actions[i % actions.length];
  const created = new Date();
  created.setMinutes(created.getMinutes() - i * 18);
  const severity = severities[i % severities.length];
  return {
    id: `LOG-${String(90001 + i)}`,
    admin: admins[i % admins.length],
    role: roles[i % roles.length],
    module: modules[i % modules.length],
    action,
    description: `${descriptions[action]} Reference LOG-${String(90001 + i)}.`,
    ipAddress: `103.${(i % 200) + 10}.${(i % 180) + 20}.${(i % 250) + 5}`,
    browser: browsers[i % browsers.length],
    timestamp: created.toISOString(),
    severity,
    metadata: { entityId: `ENT-${1000 + (i % 500)}`, sessionId: `SES-${8800 + i}` },
  };
}

export const MOCK_ACTIVITY_LOGS = Array.from({ length: 100 }, (_, i) => makeLog(i + 1));

export const LOG_MODULES = modules;
export const LOG_SEVERITIES = severities;
export const LOG_ACTIONS = actions;
