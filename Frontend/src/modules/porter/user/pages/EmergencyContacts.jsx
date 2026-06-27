import React, { useState } from "react";
import { Phone, Plus, Trash2, User } from "lucide-react";
import Screen from "../components/Screen";
import BottomSheet from "../components/BottomSheet";
import { PrimaryButton } from "../components/ui";
import { EMERGENCY_CONTACTS } from "../utils/mock/payments";

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState(EMERGENCY_CONTACTS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", relation: "Family" });

  const addContact = () => {
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 10) return;
    setContacts((prev) => [...prev, { id: `ec${Date.now()}`, ...form }]);
    setForm({ name: "", phone: "", relation: "Family" });
    setSheetOpen(false);
  };

  const removeContact = (id) => setContacts((prev) => prev.filter((c) => c.id !== id));

  return (
    <Screen
      title="Emergency contacts"
      subtitle="Notified when SOS is triggered"
      right={
        <button type="button" onClick={() => setSheetOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1F1] text-[#FF0000]">
          <Plus className="h-5 w-5" />
        </button>
      }
    >
      <p className="mb-4 text-[13px] text-gray-500">
        These contacts receive your live location and shipment details if you trigger SOS during a delivery.
      </p>

      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1F1]">
              <User className="h-5 w-5 text-[#FF0000]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-gray-900">{c.name}</p>
              <p className="text-[12px] text-gray-500">{c.relation} · {c.phone}</p>
            </div>
            <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
              <Phone className="h-4 w-4 text-[#FF0000]" />
            </a>
            <button type="button" onClick={() => removeContact(c.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add emergency contact">
        <div className="space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Contact name"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Phone number"
            inputMode="tel"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
          <input
            value={form.relation}
            onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))}
            placeholder="Relation (e.g. Family, Friend)"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
          <PrimaryButton onClick={addContact}>Save contact</PrimaryButton>
        </div>
      </BottomSheet>
    </Screen>
  );
}
