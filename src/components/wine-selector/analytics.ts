export function trackEvent(eventName: string, payload: Record<string, string | number>) {
  console.log("[event]", eventName, payload);
}
