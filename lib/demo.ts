// Never bypass authentication on Vercel, even if LOCAL_DEMO was set by mistake.
export function localDemoAllowed() {
  return (
    process.env.VERCEL !== "1" &&
    (process.env.NODE_ENV === "development" || process.env.LOCAL_DEMO === "1")
  );
}
