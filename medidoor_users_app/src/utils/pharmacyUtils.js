export const checkIsOpen = (pharmacyData) => {
  if (!pharmacyData?.openTime || !pharmacyData?.closeTime) return false;
  
  const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const currentDayIndex = now.getDay();
  const todayStr = daysMap[currentDayIndex];
  
  const yesterdayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
  const yesterdayStr = daysMap[yesterdayIndex];
  
  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const openMins = parseTime(pharmacyData.openTime);
  const closeMins = parseTime(pharmacyData.closeTime);

  const isOpenToday = pharmacyData?.openDays?.includes(todayStr);
  const isOpenYesterday = pharmacyData?.openDays?.includes(yesterdayStr);

  // If open and close times are the same (e.g., 06:00 AM to 06:00 AM)
  // we assume it means the pharmacy is open 24 hours for the selected open days.
  if (openMins === closeMins) {
    return isOpenToday;
  }

  if (closeMins < openMins) {
    // Shift crosses midnight (e.g., 10 PM to 6 AM)
    if (currentMins >= openMins && isOpenToday) {
      return true; // Before midnight, started today
    }
    if (currentMins <= closeMins && isOpenYesterday) {
      return true; // After midnight, started yesterday
    }
    return false;
  } else {
    // Standard shift (e.g., 9 AM to 9 PM)
    if (!isOpenToday) return false;
    return currentMins >= openMins && currentMins <= closeMins;
  }
};
