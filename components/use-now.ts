import { useEffect, useState } from "react";
// Refresh idle screens, while using the current time on every state change.
export function useNow() {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  return Date.now();
}
