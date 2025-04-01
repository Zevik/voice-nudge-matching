import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = "https://dhakqxhwgaacjneeitew.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoYWtxeGh3Z2FhY2puZWVpdGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyODU2MjgsImV4cCI6MjA1ODg2MTYyOH0.7GVIp_s4LW5QyoqTB3-gr-qHnhXfoDfc5IVGyUKjZDI";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // הוספת הגדרות מפורשות לאחסון - שימוש ב-localStorage במקום ב-sessionStorage
    storage: localStorage
  }
});

// הוספת מאזין לשינויי מצב האימות עבור תיעוד ובדיקת המערכת
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`[Auth] State changed: ${event}`, session ? "User is authenticated" : "No active session");
});