/**
 * Formats a 24-hour time string (HH:mm) into a 12-hour AM/PM string.
 * @param {string} time24 - The time in "HH:mm" format.
 * @returns {string} The time in "h:mm A" format.
 */
export const formatTimeAMPM = (time24) => {
  if (!time24 || typeof time24 !== "string" || !time24.includes(":")) return time24;
  if (/am|pm/i.test(time24)) return time24; // already formatted
  
  const [hourStr, minuteStr] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  
  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'
  
  return `${hour}:${minuteStr} ${ampm}`;
};

/**
 * Formats an opening hours string "HH:mm - HH:mm" into a 12-hour AM/PM string.
 * @param {string} hoursStr - The time in "HH:mm - HH:mm" format.
 * @returns {string} The time in "h:mm A - h:mm A" format.
 */
export const formatOpeningHoursAMPM = (hoursStr) => {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.includes("-")) return hoursStr;
  const [open, close] = hoursStr.split("-").map(s => s.trim());
  return `${formatTimeAMPM(open)} - ${formatTimeAMPM(close)}`;
};

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
