package com.charles.aisocial

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
// @generated begin aisocial-litert-llm-import - expo prebuild (DO NOT MODIFY) sync-8d1cbceef636add023d2af35b5524331482c5d4c
import com.charles.aisocial.litert.LiteRtLlmPackage
// @generated end aisocial-litert-llm-import
// @generated begin aisocial-feedback-import - expo prebuild (DO NOT MODIFY) sync-ccb3e05499420a78983617bde14e736eae7558e6
import com.charles.aisocial.feedback.FeedbackPackage
// @generated end aisocial-feedback-import

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
// @generated begin aisocial-litert-llm-pkg - expo prebuild (DO NOT MODIFY) sync-3ea3215c862016f05c0a17deb985978a1cc99664
              add(LiteRtLlmPackage())
// @generated end aisocial-litert-llm-pkg
// @generated begin aisocial-feedback-pkg - expo prebuild (DO NOT MODIFY) sync-36ff24b8a238c48b8ece334036cb17a375196ce3
              add(FeedbackPackage())
// @generated end aisocial-feedback-pkg
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
