const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package.json exports to fix the error:
// "The package at "node_modules\\ws\\lib\\stream.js" attempted to import the Node standard library module "stream"
config.resolver.unstable_enablePackageExports = false;

// Add condition names to improve compatibility
config.resolver.unstable_conditionNames = ["require", "default", "browser"];

// Add custom resolveRequest function for specific modules like axios
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "axios") {
    // Specifically use 'browser' condition for axios
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ["browser"] },
      moduleName,
      platform
    );
  }
  // Fallback to default resolver for other modules
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config; 