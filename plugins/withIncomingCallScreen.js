const { withAndroidManifest } = require('expo/config-plugins');

const MAIN_ACTIVITY = '.MainActivity';

/**
 * Lets the call screen come up over the lock screen.
 *
 * The full-screen intent in the alarm notification can only launch the activity
 * if it is allowed to show while locked and to wake the display, and those are
 * attributes of MainActivity in the generated manifest.
 */
module.exports = function withIncomingCallScreen(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const activity = application?.activity?.find(
      (item) => item.$?.['android:name'] === MAIN_ACTIVITY,
    );

    if (activity) {
      activity.$['android:showWhenLocked'] = 'true';
      activity.$['android:turnScreenOn'] = 'true';
    }

    return config;
  });
};
