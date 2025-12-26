module.exports = {
  dependencies: {
    '@react-native-ml-kit/text-recognition': {
      platforms: {
        android: {
          sourceDir: './node_modules/@react-native-ml-kit/text-recognition/android',
          packageImportPath: 'import com.reactnativemlkittextrecognition.RNMLKitTextRecognitionPackage;',
          packageInstance: 'new RNMLKitTextRecognitionPackage()',
        },
        ios: null, // iOS uses CocoaPods
      },
    },
  },
};


