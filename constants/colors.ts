// Our main color scheme - green for primary and orange for secondary
const primaryColor = "#2E8B57";
const secondaryColor = "#FFA500";

export default {
  primary: primaryColor,     // Forest green - used for most buttons and links
  secondary: secondaryColor, // Tasty orange - used for highlights and accents
  background: "#FFFFFF",     // Clean white background
  text: "#333333",           // Nearly black text that's easy to read
  lightText: "#666666",      // Grey text for less important stuff
  error: "#FF3B30",          // Bright red for errors and delete actions
  success: "#4CD964",        // Nice green for success messages
  warning: "#FF9500",        // Amber for warnings and important notices
  border: "#E5E5E5",         // Subtle grey for borders and dividers
  card: "#F9F9F9",           // Slightly off-white for cards
  placeholder: "#BBBBBB",    // Placeholder text in inputs
  disabled: "#DDDDDD",       // Grey for disabled buttons and components
  tabBar: {
    active: primaryColor,    // Active tab gets our primary green 
    inactive: "#BBBBBB",     // Inactive tabs are grey
    background: "#FFFFFF"    // White background for the tab bar
  }
};