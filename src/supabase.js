import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xkyaumxkysyrfwumvswi.supabase.co'
const supabaseKey = 'sb_publishable_U7ucBfUpDtgVklRlhS1uYA_xOSOQ5cU'

export const supabase = createClient(supabaseUrl, supabaseKey)
