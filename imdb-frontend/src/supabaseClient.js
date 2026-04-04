import { createClient } from '@supabase/supabase-js'

// Replace with your actual Supabase URL and Anon Key via environment variables
const supabaseUrl = 'https://fngahnkyxncfmrsvdjfa.supabase.co/'
const supabaseKey = 'sb_publishable_UqNyw5Z1GZAF9IHsohlIIA_BekpBj5g'

export const supabase = createClient(supabaseUrl, supabaseKey)