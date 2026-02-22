import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rofbrevmmtyxhcdyqirz.supabase.co";
const supabaseAnonKey = "sb_publishable_cLRTUTbOO1ysIWZMFo8GfA_-F_bWB4q";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
