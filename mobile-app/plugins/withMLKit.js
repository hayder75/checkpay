const { withSettingsGradle, withAppBuildGradle, withMainApplication } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to add ML Kit Text Recognition
 */
function withMLKit(config) {
  // Add to settings.gradle
  config = withSettingsGradle(config, (config) => {
    if (!config.modResults.contents.includes('react-native-ml-kit-text-recognition')) {
      config.modResults.contents += `
include ':react-native-ml-kit-text-recognition'
project(':react-native-ml-kit-text-recognition').projectDir = new File(rootProject.projectDir, '../node_modules/@react-native-ml-kit/text-recognition/android')
`;
    }
    return config;
  });

  // Add to app/build.gradle dependencies
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('react-native-ml-kit-text-recognition')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {
    implementation project(':react-native-ml-kit-text-recognition')`
      );
    }
    return config;
  });

  // Add to MainApplication.kt - add import and package
  config = withMainApplication(config, (config) => {
    const contents = config.modResults.contents;
    
    // Add import statement
    if (!contents.includes('RNMLKitTextRecognitionPackage')) {
      // Add import after other imports
      config.modResults.contents = contents.replace(
        'import expo.modules.ReactNativeHostWrapper',
        `import expo.modules.ReactNativeHostWrapper
import com.rnmlkit.textrecognition.TextRecognitionPackage`
      );
      
      // Add package to the list
      config.modResults.contents = config.modResults.contents.replace(
        '// Packages that cannot be autolinked yet can be added manually here, for example:',
        `// Packages that cannot be autolinked yet can be added manually here, for example:
              add(TextRecognitionPackage())`
      );
    }
    
    return config;
  });

  return config;
}

module.exports = withMLKit;
