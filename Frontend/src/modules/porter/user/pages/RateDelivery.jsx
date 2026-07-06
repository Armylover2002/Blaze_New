import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, ThumbsUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import porterUserApi from "../services/userApi";

const TAGS = ["On time", "Careful handling", "Professional", "Good communication", "Safe driving"];

export default function RateDelivery() {
  const navigate = useNavigate();
  const { activeShipment, resetBooking } = useBooking();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const submit = async () => {
    const orderId = activeShipment?.id;
    if (!orderId) {
      toast.error("No order to rate");
      return;
    }
    setSubmitting(true);
    try {
      const tagNote = tags.length ? ` Tags: ${tags.join(", ")}` : "";
      await porterUserApi.rateOrder(orderId, {
        score: rating,
        comment: `${comment}${tagNote}`.trim(),
      });
      resetBooking();
      navigate("/porter/shipments", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Rate delivery" subtitle="How was your parcel delivery?">
      <div className="mb-6 flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F1] text-[24px] font-bold text-[#FF0000]">
          P
        </div>
        <p className="text-[16px] font-extrabold text-gray-900">Your delivery partner</p>
        <p className="text-[12px] text-gray-500">{activeShipment?.vehicle || "Parcel"}</p>
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
            <Star
              className={`h-10 w-10 transition ${n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-gray-400">What went well?</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
              tags.includes(tag) ? "bg-[#FF0000] text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Additional feedback (optional)"
        rows={3}
        className="mb-4 w-full resize-none rounded-2xl border border-gray-200 bg-white p-3 text-[14px] outline-none focus:border-[#FF0000]"
      />

      <StickyBar>
        <PrimaryButton disabled={rating === 0 || submitting} onClick={submit}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ThumbsUp className="h-4 w-4" /> Submit rating</>}
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
