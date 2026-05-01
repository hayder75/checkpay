const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withSMSRoleManager(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = config.android?.package || 'com.checkpay.mobile';
      const packagePath = packageName.replace(/\./g, '/');

      const srcMainPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        packagePath
      );

      if (!fs.existsSync(srcMainPath)) {
        fs.mkdirSync(srcMainPath, { recursive: true });
      }

      const modulePath = path.join(srcMainPath, 'SMSRoleManagerModule.kt');
      const moduleContent = `package ${packageName}

import android.app.role.RoleManager
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SMSRoleManagerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SMSRoleManager"

  @ReactMethod
  fun isDefaultSMSApp(promise: Promise) {
    try {
      val packageName = reactContext.packageName
      val defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(reactContext)
      promise.resolve(defaultSmsPackage == packageName)
    } catch (e: Exception) {
      promise.reject("SMS_ROLE_CHECK_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun requestDefaultSMSRole(promise: Promise) {
    try {
      val activity = reactApplicationContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No active activity available")
        return
      }

      val packageName = reactContext.packageName
      val defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(reactContext)
      if (defaultSmsPackage == packageName) {
        promise.resolve(true)
        return
      }

      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val roleManager = reactContext.getSystemService(RoleManager::class.java)
        if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
          roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
        } else {
          Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
            putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, packageName)
          }
        }
      } else {
        Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
          putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, packageName)
        }
      }

      activity.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SMS_ROLE_REQUEST_FAILED", e.message, e)
    }
  }
}
`;
      fs.writeFileSync(modulePath, moduleContent);

      const packageFilePath = path.join(srcMainPath, 'SMSRoleManagerPackage.kt');
      const packageContent = `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SMSRoleManagerPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(SMSRoleManagerModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;
      fs.writeFileSync(packageFilePath, packageContent);

      const mainApplicationPath = path.join(srcMainPath, 'MainApplication.kt');
      if (fs.existsSync(mainApplicationPath)) {
        let content = fs.readFileSync(mainApplicationPath, 'utf8');

        if (!content.includes('add(SMSRoleManagerPackage())')) {
          if (content.includes('add(TextRecognitionPackage())')) {
            content = content.replace(
              'add(TextRecognitionPackage())',
              'add(TextRecognitionPackage())\n              add(SMSRoleManagerPackage())'
            );
          } else if (content.includes('// add(MyReactNativePackage())')) {
            content = content.replace(
              '// add(MyReactNativePackage())',
              'add(SMSRoleManagerPackage())\n              // add(MyReactNativePackage())'
            );
          }
          fs.writeFileSync(mainApplicationPath, content);
        }
      }

      console.log('✅ [withSMSRoleManager] SMS role native bridge configured');
      return config;
    },
  ]);
}

module.exports = withSMSRoleManager;
