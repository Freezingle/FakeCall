# FakeCall

Simulates an incoming phone call so you have an excuse to step away. It **only simulates** a call inside the app. It never dials a number, sends a message, or touches the real phone app.

Stack: Expo SDK 58, React Native 0.88, TypeScript (strict), Expo Router, expo-audio, expo-haptics, AsyncStorage.

## Run it

Prerequisites: Node 20+ and an Android phone with USB debugging enabled (or an Android Studio emulator).

```bash
npm install

# Fastest: Expo Go (install "Expo Go" from the Play Store; phone and computer on the same Wi-Fi)
npx expo start
# then scan the QR code with Expo Go

# If Wi-Fi discovery fails, use the USB cable instead:
adb devices                      # the phone should be listed
adb reverse tcp:8081 tcp:8081
npx expo start --localhost

# Development build (needed from Stage 2 onward; requires Android Studio SDK + JDK 17):
npx expo run:android
```

Checks:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest (state machine, settings parsing, time formatting)
npx expo install --check   # verify dependency versions against the SDK (needs internet)
```

## Structure

```
src/
  app/                    Routes: index (home), incoming, active, settings
  components/             Avatar, RoundButton, PulseRing
  features/calls/         callReducer (state machine), CallProvider (timers, audio, lifecycle), CallNavigator
  features/settings/      Defaults and SettingsProvider
  services/audio/         callAudio (the only place players are created/released) + bundled audio catalog
  services/feedback/      Ring vibration (core Vibration) and button haptics (expo-haptics)
  services/scheduling/    Delay presets, time formatting, useNow ticker
  storage/                AsyncStorage persistence with defensive parsing
  theme/                  Palettes and spacing
  types/                  Shared types
assets/audio/             Two ringtones (generated locally)
```

Design notes:

- **One state machine.** `callReducer` defines every legal transition (`idle -> ringing -> active -> idle`). Illegal ones are no-ops, which is what prevents duplicate triggers.
- **Screens never navigate for call transitions.** `CallNavigator` watches the phase and navigates. Screens only call `answer()` / `hangUp()`.
- **Audio cleanup is tied to the phase.** Effects in `CallProvider` start ringtone/vibration on `ringing` and the user's picked clip on `active`; their cleanup functions stop everything whenever the phase changes or the provider unmounts.
- **Mute and Speaker are simulation controls.** Mute shows a muted state (the app has no microphone access). Speaker raises the voice clip volume and requests earpiece vs speaker routing as a best effort.

## Android behaviour and limitations (Stage 1)

- Calls are simulated **while the app is open**. A scheduled call that comes due while the app is backgrounded rings when you return to the app.
- If the app goes to the background while ringing, the ring is stopped and the call ends as missed. A call screen you cannot see should not keep making noise.
- The ringtone follows the phone's ringer mode (silent/vibrate suppress it), like a real call. Vibration is a separate setting.
- The incoming screen is a React Native screen styled like an incoming call. It is not the system Phone app, and it does not appear over the lock screen or other apps. Notifications and full-screen intents are Stage 2.
- Immersive mode hides the status and navigation bars where Android allows; swiping from an edge can reveal them.
- Android's earpiece routing through expo-audio is not guaranteed on all devices. If you need reliable routing, that is a candidate for a small Kotlin module in Stage 3.
- Permissions used: `VIBRATE` (normal permission, granted at install). No runtime permission prompts in Stage 1.
- **An answered call is silent.** Nothing is bundled to play during the call; pick an audio file under Settings → Voice clip and it plays automatically once you answer.
- The app icon and splash image are still the Expo template defaults.

## MVP verification checklist

1. App opens to the home screen with caller "Mom", **Call Me Now**, four delay chips, and **Schedule Fake Call**.
2. **Call Me Now**: the incoming screen appears full-screen and dark, the ringtone plays and the phone vibrates (if not in silent mode).
3. **Decline**: sound and vibration stop immediately and you land on home. Android Back does nothing on the call screen.
4. **Call Me Now, then Answer**: ringing stops, the timer counts up, and no audio plays (no clip is picked).
5. **Speaker** toggles louder/quieter. **Mute** toggles its highlighted state. After picking a clip in Settings, **Pause clip / Play clip** appears on the active screen, the clip plays on answer, and Play restarts it after it finishes.
6. **End call**: audio stops, you return to home. Trigger another call; mute and speaker are reset.
7. **Schedule**: pick 10 sec, tap Schedule. The countdown shows, the "Call scheduled in 10 seconds" message appears, and the call rings at zero.
8. **Cancel**: schedule 1 min, tap Cancel. "Scheduled call cancelled" appears and nothing rings.
9. Schedule 10 sec, tap **Call Me Now** before it fires: exactly one call, and no second ring when the 10 seconds elapse.
10. Let a call ring without answering: it stops by itself after about 45 seconds.
11. **Settings**: change the name, avatar colour and ringtone (a preview plays). Force-close and reopen: changes persist. **Reset to defaults** restores them.
12. Clear the name field: an error shows and the previous name is kept.
13. Try a small phone or the emulator's smallest profile, plus display/font size set to large: nothing is clipped.
