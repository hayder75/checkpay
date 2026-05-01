/**
 * Utility to get the display name of a user.
 * Priority: username -> first name (+ last name) -> phone -> "User"
 */
export const getDisplayName = (user: any): string => {
  if (!user) return 'User';
  
  // Handle cases where the user object might be nested (e.g., from API response)
  const userData = user.user || user.data || user;
  
  // 1. Try firstName (camelCase or snake_case)
  const fName = userData.firstName || userData.first_name || userData.name;
  
  if (fName) {
    return fName;
  }
  
  // 2. Try username as fallback
  if (userData.username) {
    return userData.username;
  }
  
  // 3. Try phone
  if (userData.phone) {
    return userData.phone;
  }
  
  return 'User';
};

/**
 * Utility to get the initials of a user for avatar display.
 */
export const getUserInitials = (user: any): string => {
  if (!user) return 'U';
  
  const name = getDisplayName(user);
  if (name === 'User') return 'U';
  
  // If it's a phone number, return the first digit or 'U'
  if (/^\+?\d+$/.test(name)) {
    return name.replace('+', '')[0] || 'U';
  }
  
  return name[0].toUpperCase();
};
