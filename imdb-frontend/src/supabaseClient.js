import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fngahnkyxncfmrsvdjfa.supabase.co/'
const supabaseKey = 'sb_publishable_UqNyw5Z1GZAF9IHsohlIIA_BekpBj5g'

export const supabase = createClient(supabaseUrl, supabaseKey)