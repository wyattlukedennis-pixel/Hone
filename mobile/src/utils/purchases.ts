/**
 * Purchase gate for reveal exports.
 *
 * Uses RevenueCat when REVENUECAT_API_KEY is set, otherwise falls back
 * to a simulated AsyncStorage-backed flow for development.
 *
 * To go live:
 * 1. Create a non-consumable IAP in App Store Connect:
 *    Product ID: "com.hone.mobile.reveal_export", Price: $2.99
 * 2. Create a RevenueCat project at https://app.revenuecat.com
 *    - Add your App Store app
 *    - Add the IAP product
 *    - Create entitlement "reveal_export" and attach the product
 *    - Create an offering "default" with a package containing the product
 * 3. Copy your RevenueCat Apple API key below
 * 4. Rebuild native binary: npx expo run:ios --device
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, {
  type PurchasesPackage,
  type CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";

// -- Configuration ----------------------------------------------------------

/**
 * Set this to your RevenueCat Apple API key to enable real purchases.
 * Leave empty for simulated dev flow (only works in __DEV__).
 *
 * IMPORTANT: Set this before submitting to the App Store.
 */
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "";

const ENTITLEMENT_ID = "reveal_export";
const PRODUCT_ID = "com.hone.mobile.reveal_export";
const PRICE_DISPLAY = "$4.99";
const STORAGE_KEY = "@hone:reveal_purchased";

// -- State ------------------------------------------------------------------

let _purchased = false;
let _initialized = false;
let _package: PurchasesPackage | null = null;

// -- Helpers ----------------------------------------------------------------

function checkEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

// -- Public API -------------------------------------------------------------

/** Initialize purchase state. Call once on app startup. */
export async function initPurchases(): Promise<void> {
  if (_initialized) return;

  if (!REVENUECAT_API_KEY && !__DEV__) {
    console.warn("[purchases] EXPO_PUBLIC_REVENUECAT_API_KEY is not set — purchases will be simulated. This must be set before App Store submission.");
  }

  if (REVENUECAT_API_KEY) {
    try {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: null, // anonymous until identified
      });
      const info = await Purchases.getCustomerInfo();
      _purchased = checkEntitlement(info);

      // Pre-fetch the package for faster purchase flow
      try {
        const offerings = await Purchases.getOfferings();
        _package = offerings.current?.availablePackages[0] ?? null;
      } catch {
        // Non-fatal — we'll fetch again at purchase time
      }
    } catch (error) {
      if (__DEV__) console.error("[purchases] RevenueCat init failed:", error);
      // Fall back to storage check
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      _purchased = stored === "true";
    }
  } else {
    // Simulated: check AsyncStorage
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    _purchased = stored === "true";
  }

  _initialized = true;
}

/** Identify the user after login/signup (links purchases to account). */
export async function identifyUser(userId: string): Promise<void> {
  if (!REVENUECAT_API_KEY) return;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    _purchased = checkEntitlement(customerInfo);
  } catch (error) {
    if (__DEV__) console.error("[purchases] identify failed:", error);
  }
}

/** Check if the user has purchased reveal export. */
export function hasRevealExportPurchase(): boolean {
  return _purchased;
}

/** Attempt to purchase reveal export. Returns true on success. */
export async function purchaseRevealExport(): Promise<boolean> {
  if (_purchased) return true;

  if (REVENUECAT_API_KEY) {
    try {
      // Fetch package if we don't have it
      if (!_package) {
        const offerings = await Purchases.getOfferings();
        _package = offerings.current?.availablePackages[0] ?? null;
      }

      if (!_package) {
        if (__DEV__) console.error("[purchases] No package available");
        return false;
      }

      const { customerInfo } = await Purchases.purchasePackage(_package);
      _purchased = checkEntitlement(customerInfo);

      if (_purchased) {
        // Also persist locally for faster startup check
        await AsyncStorage.setItem(STORAGE_KEY, "true");
      }

      return _purchased;
    } catch (error: unknown) {
      const purchaseError = error as { userCancelled?: boolean };
      if (purchaseError.userCancelled) return false;
      throw error;
    }
  }

  // Simulated: auto-succeed and persist
  _purchased = true;
  await AsyncStorage.setItem(STORAGE_KEY, "true");
  return true;
}

/** Restore previous purchases. */
export async function restorePurchases(): Promise<boolean> {
  if (REVENUECAT_API_KEY) {
    try {
      const info = await Purchases.restorePurchases();
      _purchased = checkEntitlement(info);
      if (_purchased) {
        await AsyncStorage.setItem(STORAGE_KEY, "true");
      }
      return _purchased;
    } catch (error) {
      if (__DEV__) console.error("[purchases] restore failed:", error);
      return false;
    }
  }

  // Simulated: check storage
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  _purchased = stored === "true";
  return _purchased;
}

/** Reset purchase state (dev tools only). */
export async function resetPurchaseState(): Promise<void> {
  _purchased = false;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Simulate a purchase locally (dev/testflight tools only). */
export async function simulatePurchase(): Promise<void> {
  _purchased = true;
  await AsyncStorage.setItem(STORAGE_KEY, "true");
}

/** Get display price string. */
export function getRevealExportPrice(): string {
  if (_package?.product?.priceString) {
    return _package.product.priceString;
  }
  return PRICE_DISPLAY;
}

/** Get product ID for display/debugging. */
export function getProductId(): string {
  return PRODUCT_ID;
}
