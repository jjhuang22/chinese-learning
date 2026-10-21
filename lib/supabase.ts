import { supabaseProjectUrl } from "./supabase-config";
import { createBrowserClient } from "@supabase/ssr";
const projectUrl = supabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const cloudEnabled = Boolean(
  projectUrl && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
export const supabase = cloudEnabled
  ? createBrowserClient(projectUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  : null;
