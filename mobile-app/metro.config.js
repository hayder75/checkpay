const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// pnpm uses a virtual store outside the project root (see .npmrc `virtual-store-dir`).
// Metro must watch and resolve from it as well.
const pnpmVirtualStore = 'C:\\pv';
const sharedStoreModules = path.join(pnpmVirtualStore, 'node_modules');

config.watchFolders = [...(config.watchFolders || []), pnpmVirtualStore];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  sharedStoreModules,
  ...(config.resolver.nodeModulesPaths || []),
];

module.exports = config;
