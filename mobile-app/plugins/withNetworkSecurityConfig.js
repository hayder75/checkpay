const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to enable cleartext HTTP traffic on Android
 * Required for apps that need to communicate with HTTP (non-HTTPS) servers
 */
function withNetworkSecurityConfig(config) {
  // Step 1: Create network_security_config.xml
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      
      // Path to res/xml directory
      const resXmlPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      
      // Ensure directory exists
      if (!fs.existsSync(resXmlPath)) {
        fs.mkdirSync(resXmlPath, { recursive: true });
      }
      
      // Create network_security_config.xml
      const configPath = path.join(resXmlPath, 'network_security_config.xml');
      const configContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext (HTTP) traffic for development and specific domains -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <!-- For debug builds, also trust user-installed certificates -->
            <certificates src="user" />
        </trust-anchors>
    </base-config>
    
    <!-- Specific domain configurations (optional) -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">144.217.161.251</domain>
        <domain includeSubdomains="true">192.168.43.160</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
`;
      
      fs.writeFileSync(configPath, configContent);
      console.log('✅ [withNetworkSecurityConfig] Created network_security_config.xml');
      
      return config;
    },
  ]);

  // Step 2: Reference the config in AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    
    // Ensure application element exists
    if (!manifest.application || !manifest.application[0]) {
      manifest.application = [{ $: {} }];
    }
    
    const application = manifest.application[0];
    
    // Add networkSecurityConfig attribute
    if (!application.$) {
      application.$ = {};
    }
    
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    application.$['android:usesCleartextTraffic'] = 'true';
    
    console.log('✅ [withNetworkSecurityConfig] Updated AndroidManifest.xml');
    
    return config;
  });

  return config;
}

module.exports = withNetworkSecurityConfig;
