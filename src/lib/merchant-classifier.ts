// lib/merchant-classifier.ts
import { supabase, MerchantMapping } from './supabase'

export class MerchantClassifier {
  private static mappings: MerchantMapping[] = []
  private static lastFetch = 0
  private static CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  
  static async classifyMerchant(rawMerchant: string): Promise<{ cleanName: string; category?: string }> {
    await this.loadMappings()
    
    const upperRaw = rawMerchant.toUpperCase()
    
    // Try exact match first
    const exactMatch = this.mappings.find(m => 
      m.pattern_type === 'exact' && m.raw_pattern.toUpperCase() === upperRaw
    )
    if (exactMatch) {
      return { cleanName: exactMatch.clean_name, category: exactMatch.category }
    }
    
    // Try contains match
    const containsMatch = this.mappings.find(m => 
      m.pattern_type === 'contains' && upperRaw.includes(m.raw_pattern.toUpperCase())
    )
    if (containsMatch) {
      return { cleanName: containsMatch.clean_name, category: containsMatch.category }
    }
    
    // Try regex match
    const regexMatch = this.mappings.find(m => {
      if (m.pattern_type === 'regex') {
        try {
          const regex = new RegExp(m.raw_pattern, 'i')
          return regex.test(rawMerchant)
        } catch (e) {
          return false
        }
      }
      return false
    })
    if (regexMatch) {
      return { cleanName: regexMatch.clean_name, category: regexMatch.category }
    }
    
    // Fallback: clean up the raw merchant name
    const cleanName = this.fallbackCleanup(rawMerchant)
    return { cleanName }
  }
  
  private static async loadMappings() {
    const now = Date.now()
    if (now - this.lastFetch < this.CACHE_DURATION && this.mappings.length > 0) {
      return // Use cached mappings
    }
    
    try {
      const { data, error } = await supabase
        .from('merchant_mappings')
        .select('*')
        .order('raw_pattern')
      
      if (error) throw error
      
      this.mappings = data || []
      this.lastFetch = now
    } catch (error) {
      console.error('Error loading merchant mappings:', error)
      // Continue with existing mappings if any
    }
  }
  
  private static fallbackCleanup(rawMerchant: string): string {
    let cleaned = rawMerchant
    
    // Remove common BofA prefixes/suffixes
    cleaned = cleaned.replace(/^(PURCHASE\s+|RECURRING\s+|ONLINE\s+)/i, '')
    
    // Remove location codes and numbers at the end
    cleaned = cleaned.replace(/\s+[A-Z]{2}\s*\d*$/, '') // Remove state codes
    cleaned = cleaned.replace(/\s+#?\d{4,}.*$/, '') // Remove long numbers
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    
    // Title case
    cleaned = this.toTitleCase(cleaned)
    
    return cleaned
  }
  
  private static toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
  }
  
  // Helper method to add new mappings
  static async addMapping(
    rawPattern: string, 
    cleanName: string, 
    category?: string, 
    patternType: 'contains' | 'regex' | 'exact' = 'contains'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('merchant_mappings')
        .insert({
          raw_pattern: rawPattern,
          clean_name: cleanName,
          category,
          pattern_type: patternType
        })
      
      if (error) throw error
      
      // Refresh cache
      this.lastFetch = 0
      await this.loadMappings()
      
      return true
    } catch (error) {
      console.error('Error adding merchant mapping:', error)
      return false
    }
  }
}