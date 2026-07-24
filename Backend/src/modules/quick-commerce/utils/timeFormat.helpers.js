/**
 * Checks if the current time falls within the given opening hours string.
 * @param {string} openingHoursStr - Expected format "HH:mm - HH:mm"
 * @returns {boolean} True if currently open, false if closed.
 */
export const isStoreCurrentlyOpen = (openingHoursStr) => {
  if (!openingHoursStr || typeof openingHoursStr !== "string" || !openingHoursStr.includes("-")) {
    return true; // default to open if invalid format
  }

  try {
    const [openStr, closeStr] = openingHoursStr.split("-").map(s => s.trim());
    
    if (!openStr || !closeStr) return true;

    const now = new Date();
    // Use IST timezone since it's India specific (as per other defaults) or use UTC if global.
    // Assuming local server time for now, as that's what we did in frontend.
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [openH, openM] = openStr.split(":").map(Number);
    const [closeH, closeM] = closeStr.split(":").map(Number);
    
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    
    // Handle overnight shifts (e.g., "22:00 - 06:00")
    if (closeMinutes <= openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch (error) {
    console.error("Error evaluating opening hours:", error);
    return true; // Fallback to true if there's an error
  }
};
