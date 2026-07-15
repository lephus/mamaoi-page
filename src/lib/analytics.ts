/**
 * Fire a conversion once a registration actually succeeds — not on button click,
 * which would count every failed and abandoned attempt as a win and quietly
 * inflate the numbers the client optimises their ad spend against.
 *
 * No-ops when the trackers are not configured.
 */
export function trackRegistration(nguon: "su-kien" | "app-waitlist") {
  if (typeof window === "undefined") return;

  const w = window as typeof window & {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };

  w.gtag?.("event", "sign_up", { method: nguon });
  w.fbq?.("track", nguon === "su-kien" ? "CompleteRegistration" : "Lead");
}
