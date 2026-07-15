/**
 * Sequenced cart calculateOrder controller.
 * Guarantees only the latest request may update React pricing state.
 * Uses monotonic requestId + AbortController.
 */

import { orderAPI } from "@food/api";
import {
  clearQuickDeliveryToast,
  getQuickDeliveryReason,
  isQuickDeliveryEligible,
  mapQuickDeliveryReason,
  shouldSoftFallbackQuickSelection,
  showQuickDeliveryUnavailableToast,
} from "@food/utils/quickDelivery";

export function createCartPricingRequestController() {
  let latestRequestId = 0;
  /** @type {AbortController | null} */
  let abortController = null;

  const begin = () => {
    latestRequestId += 1;
    const requestId = latestRequestId;
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        // ignore
      }
    }
    abortController = new AbortController();
    return { requestId, signal: abortController.signal };
  };

  const isLatest = (requestId) => requestId === latestRequestId;

  const isAbortError = (error) =>
    error?.name === "CanceledError" ||
    error?.name === "AbortError" ||
    error?.code === "ERR_CANCELED" ||
    error?.message === "canceled";

  /**
   * @param {object} payload - calculateOrder body
   */
  const calculate = async (payload = {}) => {
    const { requestId, signal } = begin();
    const requestedDeliveryMode =
      String(payload.deliveryMode || "basic").toLowerCase() === "quick"
        ? "quick"
        : "basic";

    try {
      const response = await orderAPI.calculateOrder(payload, { signal });
      if (!isLatest(requestId)) {
        return {
          stale: true,
          requestId,
          requestedDeliveryMode,
          pricing: null,
          response: null,
        };
      }
      const pricing = response?.data?.data?.pricing || null;
      return {
        stale: false,
        requestId,
        requestedDeliveryMode,
        pricing,
        response,
      };
    } catch (error) {
      if (isAbortError(error) || !isLatest(requestId)) {
        return {
          stale: true,
          aborted: true,
          requestId,
          requestedDeliveryMode,
          pricing: null,
          response: null,
          error,
        };
      }
      throw error;
    }
  };

  return { begin, isLatest, calculate };
}

/**
 * Apply a non-stale calculateOrder result to cart Quick Delivery state.
 * Soft-fallback uses eligible === false only (never deliveryMode).
 */
export function applyCartPricingResult({
  result,
  setPricing,
  setDeliveryType,
  setQuickFallbackNotice,
}) {
  if (!result || result.stale) return { applied: false, softFallback: false };
  const { pricing, requestedDeliveryMode } = result;
  if (!pricing) return { applied: false, softFallback: false };

  const softFallback = shouldSoftFallbackQuickSelection({
    requestedDeliveryMode,
    pricing,
  });

  if (softFallback) {
    setDeliveryType?.("standard");
    const reason = getQuickDeliveryReason(pricing);
    const message =
      mapQuickDeliveryReason(reason) ||
      "Quick Delivery unavailable — continuing as Basic";
    setQuickFallbackNotice?.(message);
    showQuickDeliveryUnavailableToast(reason || message);
  } else if (
    requestedDeliveryMode === "quick" &&
    (isQuickDeliveryEligible(pricing) || !getQuickDeliveryReason(pricing))
  ) {
    // Latest Quick request confirmed available — drop any prior failure toast.
    clearQuickDeliveryToast();
    setQuickFallbackNotice?.(null);
  }
  // Basic quotes may include eligible=true (gate metadata). Do not clear
  // an active soft-fallback toast from those responses.

  setPricing?.(pricing);
  return { applied: true, softFallback };
}
