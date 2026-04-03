import { createClient } from '@supabase/supabase-js'

// Replace with your actual Supabase URL and Anon Key via environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://fngahnkyxncfmrsvdjfa.supabase.co/'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE'

export const supabase = createClient(supabaseUrl, supabaseKey)