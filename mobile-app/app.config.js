const appJson = require('./app.json');

const config = appJson.expo;
const buildProfile = (process.env.EAS_BUILD_PROFILE || process.env.APP_ENV || '').toLowerCase();
const isProduction = buildProfile === 'production';

const normalizedPlugins = Array.isArray(config.plugins) ? [...config.plugins] : [];
const normalizedAndroidPermissions = Array.isArray(config?.android?.permissions)
  ? [...config.android.permissions]
  : [];

const filteredPlugins = isProduction
  ? normalizedPlugins.filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== 'expo-dev-client';
    })
  : normalizedPlugins;

module.exports = {
  expo: {
    ...config,
    plugins: filteredPlugins,
    android: {
      ...config.android,
      permissions: normalizedAndroidPermissions,
    },
  },
};
