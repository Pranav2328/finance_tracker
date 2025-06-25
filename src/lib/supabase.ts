// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database tables
export interface Transaction {
  id: string
  date: string
  amount: number
  raw_merchant: string
  clean_merchant?: string
  category?: string
  description?: string
  pdf_source?: string
  created_at: string
  updated_at: string
}

export interface MerchantMapping {
  id: string
  raw_pattern: string
  clean_name: string
  category?: string
  pattern_type: 'contains' | 'regex' | 'exact'
  created_at: string
}