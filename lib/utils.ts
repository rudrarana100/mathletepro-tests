import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// This is for shadcn/ui
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// This is for the Supabase starter kit
export const hasEnvVars = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;