# Delivery Rider App (React Native & TypeScript)
> **Senior-Level Machine Test Submission (4+ Years Experience)**  
> High-Cadence Background Location Tracking • 30-Meter Haversine Threshold • Offline-First Resilient Sync Queue • Firebase Auth & Real-Time Firestore • 100% Open-Source Stack

---

## 1. Executive Summary & Architectural Overview

This application is engineered for commercial delivery riders who require reliable, battery-aware, and regulation-compliant GPS tracking across active duty shifts. It solves the critical engineering hurdles of real-world mobile tracking:

1. **Continuous 10-Second Background Polling**: Survives app minimization, screen locking, and OS task management without relying on paid commercial SDKs.
2. **Great-Circle Haversine Distance Filter**: Strict $\ge 30\text{m}$ movement threshold evaluated on every 10s fix; sub-30m jitter/drift is skipped to save network bandwidth and Firebase write costs.
3. **Offline Resilience & Idempotent Sync**: Offline fixes are persisted to durable storage and automatically flushed upon network restoration with zero duplicate entries.
4. **Firebase Real-Time Ecosystem**: Cleanly decoupled Auth (`onAuthStateChanged` session persistence) and Firestore real-time snapshots (`onSnapshot`) with offline cache fallback.

### High-Level Architecture

```
                                  +------------------------------+
                                  |    HomeScreen / UI Layer     |
                                  | (Duty Switch, Telemetry, Log)|
                                  +--------------+---------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                             |                             |
       +-----------v-----------+    +------------v------------+    +-----------v-----------+
       |   PermissionService   |    | BackgroundLocationServ. |    |  LocationLogService   |
       |  - Foreground First   |    |  - RNBackgroundActions  |    |  - Realtime Firestore |
       |  - Android 10/11/13/14|    |  - 10s Polling Loop     |    |  - onSnapshot + Cache |
       |  - iOS Always Rationale|   |  - Native Geolocation   |    |  - Pull-to-Refresh    |
       +-----------------------+    +------------+------------+    +-----------^-----------+
                                                 |                             |
                                    +------------v------------+                |
                                    |    haversineDistance    |                |
                                    |  (>= 30m Threshold Check|                |
                                    +------------+------------+                |
                                                 | (Qualified Fix)             |
                                    +------------v------------+                |
                                    |    SyncQueueService     |                |
                                    |  - UUID v4 Idempotency  |----------------+
                                    |  - NetInfo Auto-Sync    |
                                    |  - AsyncStorage Queue   |
                                    +------------+------------+
                                                 |
                                    +------------v------------+
                                    |   Firebase Firestore    |
                                    | (doc ID = RFC4122 UUID) |
                                    +-------------------------+
```

---

## 2. Directory Structure

```
DeliveryRiderApp/
├── __tests__/
│   ├── haversine.test.ts          # 8 Unit tests: Haversine distance & 30m boundary threshold
│   ├── syncQueue.test.ts          # 5 Unit tests: Offline queue, idempotency, flush on reconnect
│   └── App.test.tsx               # Smoke test for root component rendering
├── android/
│   └── app/src/main/AndroidManifest.xml # Permissions (Foreground service, location, notifications)
├── ios/
│   └── DeliveryRiderApp/Info.plist      # Permissions & UIBackgroundModes (location, fetch, processing)
├── src/
│   ├── config/
│   │   └── firebaseConfig.ts      # Firebase modular SDK initialization & AsyncStorage persistence
│   ├── types/
│   │   └── index.ts               # Core TypeScript domain models (LocationLog, Metrics, Duty)
│   ├── utils/
│   │   ├── haversine.ts           # Great-circle formula & distance threshold evaluation
│   │   └── formatters.ts          # Distance, timestamp, and coordinate formatting utilities
│   ├── services/
│   │   ├── authService.ts         # Firebase Auth, session persistence, demo fallback
│   │   ├── backgroundLocation.ts  # Background task orchestration (10s cadence, Android service)
│   │   ├── locationLogService.ts  # Live Firestore subscription, offline cache, manual refresh
│   │   ├── permissionService.ts   # Sequential Android/iOS permission workflows & rationale
│   │   └── syncQueue.ts           # Durable queue, NetInfo auto-sync, idempotent flush
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth lifecycle hook
│   │   ├── useDutyTracking.ts     # Duty switch state and live telemetry metrics hook
│   │   └── useLocationLogs.ts     # Firestore real-time listener & queue state hook
│   ├── components/
│   │   ├── LocationCard.tsx       # Live telemetry card (10s status, current coords, 30m delta)
│   │   ├── LogItem.tsx            # Chronological waypoint item with delta pill & sync badge
│   │   └── PermissionModal.tsx    # Educational pre-permission rationale modal
│   └── screens/
│       ├── AuthScreen.tsx         # Rider sign-in, account creation, and demo credential filler
│       └── HomeScreen.tsx         # Duty toggle, telemetry card, real-time list, pull-to-refresh
├── App.tsx                        # Root router with session splash and safe area provider
├── jest.config.js                 # Jest configuration with watchman safeguard
├── jest.setup.js                  # Centralized test mocks (Firebase, Geolocation, NetInfo)
└── package.json                   # Verified production dependencies
```

---

## 3. Background Location Architecture & Trade-Off Analysis

### Approach Chosen: `react-native-background-actions` + Native `@react-native-community/geolocation`

To fulfill the explicit requirement:
> *"Use only open-source libraries — nothing requiring a paid SDK/service to run or review."*

We evaluated the primary React Native background tracking architectures:

| Library / Approach | License / Cost | Background Survival (Minimized / Screen Off) | Strict 10s Cadence Control | Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **`react-native-background-actions` + Native Geolocation** *(Selected)* | **100% Free & Open-Source (MIT)** | **High** (Runs true Android Foreground Service with notification + iOS Background Task) | **Full Control** (Async loop with configurable 10s timer) | **Ideal**. Fully inspectable, zero commercial license keys, works out-of-the-box for any reviewer. |
| **`react-native-background-geolocation` (Transistor Software)** | Commercial / Paid License Required ($300+/yr per app for Android) | High | High | **Disqualified**. The Android SDK is closed-source and terminates or emits fake coordinates without a commercial license. |
| **Foreground `setInterval` / `watchPosition`** | Open-Source | None (Dies immediately when app is minimized or phone locks) | None in background | **Disqualified**. Explicitly forbidden by prompt requirements. |
| **`expo-location` + `TaskManager`** | Open-Source | Moderate | Low (OS manages batching; 10s fixed interval cannot be guaranteed on Android/iOS) | Heavy dependency footprint in a bare React Native project. |

### How It Works Under the Hood
1. When the rider toggles **On Duty**, `BackgroundLocationService.startTracking(riderId)` is invoked.
2. It launches an Android **Foreground Service** with a persistent notification (`Delivery Rider Active - Tracking Location`).
3. The foreground service holds an OS wake lock and declares `android:foregroundServiceType="location"`, which guarantees Android does not terminate or throttle the process during Doze mode.
4. Inside the execution loop, every 10 seconds:
   - High-accuracy GPS coordinates are sampled via native Geolocation.
   - The Haversine distance from the **last saved point** is computed.
   - If $\ge 30\text{m}$, the waypoint is saved (or queued offline) and the notification description dynamically updates with the new waypoint count.
   - If $< 30\text{m}$, the write is skipped, preserving battery and Firestore quotas.
5. When the rider toggles **Off Duty**, `BackgroundActions.stop()` terminates the foreground service, removes the persistent notification, and releases all wake locks.

---

## 4. Haversine Distance-Threshold Save Logic & Boundary Testing

### The Great-Circle Formula
Naive Euclidean approximations ($\sqrt{\Delta x^2 + \Delta y^2}$) fail because lines of longitude converge at the poles ($1^\circ$ longitude is $\approx 111.32\text{km}$ at the equator but $0\text{km}$ at the poles). 

We implement the spherical law of haversines using the WGS-84 mean Earth radius ($R = 6,371,000\text{m}$):

$$\Delta \phi = \text{lat}_2 - \text{lat}_1, \quad \Delta \lambda = \text{lon}_2 - \text{lon}_1$$
$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$
$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$
$$d = R \cdot c$$

### Save Decision Matrix
- **First Point of Duty**: Saved unconditionally as the baseline anchor ($d = 0\text{m}$).
- **Distance $\ge 30.0\text{m}$**: Saved to Firebase / local queue, and `lastSavedPoint` updates to the current position.
- **Distance $< 30.0\text{m}$**: Skipped. The rider's live coordinates update on the dashboard, but no database write is triggered.

### Automated Unit Test Proof (`__tests__/haversine.test.ts`)
The boundary threshold is mathematically verified at the equator along a meridian where $1\text{m} \approx \frac{180}{\pi \cdot 6371000}^\circ$:
- **$29.9\text{m}$**: `evaluateDistanceThreshold()` returns `shouldSave: false` and `reason: 'THRESHOLD_NOT_MET'`.
- **$30.0\text{m}$**: `evaluateDistanceThreshold()` returns `shouldSave: true` and `reason: 'THRESHOLD_MET'`.
- **$30.1\text{m}$**: `evaluateDistanceThreshold()` returns `shouldSave: true` and `reason: 'THRESHOLD_MET'`.
- **Antipodal / Zero-distance cases**: Verified for numerical stability with no NaN or precision exceptions.

---

## 5. Offline Resilience & Deduplicated Sync Queue

### The Strategy
A delivery rider frequently enters underground garages, elevators, and cellular dead zones. The app enforces an **offline-first queue pattern**:

```
[GPS Fix >= 30m] ---> [Generate RFC4122 v4 UUID]
                              |
                     [Check NetInfo State]
                     /                   \
              (Online)                   (Offline)
                 |                           |
        [Write to Firestore]        [Enqueue in AsyncStorage]
                 |                           |
                 v                           v
        [Confirmed Cache]           [Wait for Reconnection]
                                             |
                                    [NetInfo Trigger]
                                             |
                                    [Flush Queue to Firestore]
```

### Idempotency & Deduplication
To guarantee **zero duplicate entries** and **zero lost entries**:
1. Every qualifying location point generates a **deterministic RFC4122 v4 UUID** at creation time.
2. When flushing to Firestore, writes use `setDoc(doc(db, 'location_logs', item.id), item, { merge: true })` instead of auto-generated Firestore document IDs (`addDoc`).
3. If a network packet is dropped or retry occurs, the exact same document ID is addressed idempotently in Firestore.
4. A mutex lock (`isFlushing`) prevents concurrent duplicate flush execution.
5. Successfully flushed items are removed from AsyncStorage atomically.

---

## 6. Android vs iOS Permission Flows

Mobile OS vendors enforce strict, non-linear location permission policies:

### Android (API 29 through 34+)
1. **Pre-Permission Rationale Modal**: Before requesting system permissions, an in-app educational modal explains *why* continuous background tracking is required for delivery mileage.
2. **Foreground First**: Android 11+ prohibits requesting foreground and background location in the same dialog. We request `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` first.
3. **Android 13+ Notification Requirement**: `POST_NOTIFICATIONS` is requested so the required Foreground Service persistent notification can display.
4. **Background Location Prompt**: On Android 10+ (API 29+), `ACCESS_BACKGROUND_LOCATION` is requested separately. The OS presents the "Allow all the time" prompt.
5. **Denial Handling**: If the user selects "Don't ask again" or denies, the app does not crash or silently fail. It surfaces a banner and an alert with direct redirection to system settings via `Linking.openSettings()`.

### iOS
1. **Descriptions in `Info.plist`**:
   - `NSLocationWhenInUseUsageDescription`
   - `NSLocationAlwaysAndWhenInUseUsageDescription`
   - `NSLocationAlwaysUsageDescription`
2. **Sequential Escalation**: `requestAuthorization()` is called to obtain When-In-Use, followed by Always authorization.
3. **Background Capabilities**: `UIBackgroundModes` configured with `location`, `fetch`, and `processing`.

---

## 7. Platform Limitations & Senior Mitigations

| Platform Limitation | Impact | Production Mitigation Implemented |
| :--- | :--- | :--- |
| **Android Doze Mode & Battery Optimization** | Android suspends background network and CPU tasks when the phone is unplugged with the screen off. | Implemented an Android **Foreground Service** (`RNBackgroundActionsTask`) with `foregroundServiceType="location"` and a visible notification channel. Foreground services are exempt from aggressive Doze restrictions. |
| **Android 14 Foreground Service Restrictions** | Android 14 crashes apps that start location foreground services without declaring `android:foregroundServiceType="location"` in `AndroidManifest.xml`. | Explicitly configured `<service android:foregroundServiceType="location" />` in `AndroidManifest.xml`. |
| **iOS CoreLocation Background Throttling** | iOS pauses location updates if accuracy degrades or the app stays in the background without explicit capability flags. | Configured `UIBackgroundModes` with `location`, `fetch`, and `processing`, and enabled `enableBackgroundLocationUpdates: true` on native geolocation. |
| **Firestore Offline Query Limitations** | In disconnected states, standard Firestore listeners can throw network errors if offline persistence is not configured. | Paired Firebase modular auth with `@react-native-async-storage/async-storage` and implemented a local confirmed cache in `SyncQueueService`. Even in flight mode, all previously saved and queued points render immediately. |

---

## 8. Firebase Setup & Reviewer Demo Mode

### Reviewer Demo Mode (Zero-Config Evaluation)
The app is designed with a **fail-safe evaluation mode**:
If a reviewer runs the app without setting up their own Firebase project, the app automatically activates **Demo Mode**:
- You can sign in or register with any credentials (or tap the **"Fill Demo Credentials"** button on the sign-in screen).
- The full background tracking loop, 10-second cadence, 30m Haversine filter, and offline queue function seamlessly.
- No crashes due to missing `google-services.json` or `GoogleService-Info.plist`!

### Connecting Your Live Firebase Project
To connect your own Firebase project:
1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Email/Password Authentication** in Authentication $\rightarrow$ Sign-in method.
3. Enable **Firestore Database** in test mode.
4. Replace the credentials in `src/config/firebaseConfig.ts`:

```typescript
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
};
```

---

## 9. Setup, Running, and Testing

### Prerequisites
- Node.js >= 20
- Xcode (for iOS simulator / device)
- Android Studio + Android SDK (for Android emulator / device)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Tests
```bash
npm test
```
Runs 14 automated tests across 3 suites:
- `__tests__/haversine.test.ts`: Haversine great-circle calculation and boundary checks ($29.9\text{m}$, $30.0\text{m}$, $30.1\text{m}$, antipodal points, zero distance).
- `__tests__/syncQueue.test.ts`: RFC4122 v4 UUID generator, offline queueing, sequential writes, deduplicated flush, and idempotency.
- `__tests__/App.test.tsx`: App root rendering smoke test.

### 3. TypeScript Typecheck
```bash
npx tsc --noEmit
```
Passes with **0 errors**.

### 4. Run on Android
```bash
npm run android
```

### 5. Run on iOS
```bash
cd ios && bundle exec pod install && cd ..
npm run ios
```

---

## 10. Summary Checklist Against Machine Test Requirements

- [x] **TypeScript throughout** (zero plain JavaScript files in `/src`).
- [x] **Firebase Authentication**: Email/Password login and sign-up with `onAuthStateChanged` session persistence across restarts.
- [x] **Duty Switch**: Large, intuitive On Duty / Off Duty toggle on the home screen.
- [x] **Background-Capable Location Polling**: 100% open-source `react-native-background-actions` Foreground Service polling GPS every 10 seconds; survives backgrounding, app minimizing, and screen lock.
- [x] **Permission Flow**: Rationale modal, foreground first, background `ACCESS_BACKGROUND_LOCATION` second, Android 13+ notification permission, graceful denial handling.
- [x] **Haversine Save Logic**: WGS-84 great-circle formula; saves when $\ge 30\text{m}$, skips when $< 30\text{m}$.
- [x] **Boundary Unit Tests**: Rigorously tested at $29.9\text{m}$ (skip), $30.0\text{m}$ (save), and $30.1\text{m}$ (save).
- [x] **Offline Resilience**: Durable AsyncStorage queue, NetInfo auto-sync on reconnect, RFC4122 UUID idempotency, zero duplicate entries.
- [x] **Home Screen Waypoint List**: Live Firestore `onSnapshot` listener, timestamp, lat/lng, distance from previous point, loading/empty/error states, pull-to-refresh.
- [x] **No Paid SDKs**: Free of proprietary commercial licenses.
# Delivery-Rider-App
