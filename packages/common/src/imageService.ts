export interface ImageSource {
  url: string
  width?: number
  height?: number
  source: 'scraped' | 'news-api' | 'fallback' | 'generated'
}

export class ImageService {
  private static readonly FALLBACK_SERVICES = [
    'https://picsum.photos',
    'https://via.placeholder.com',
    'https://dummyimage.com'
  ]

  private static readonly NEWS_API_KEY = process.env.NEWS_API_KEY
  private static readonly UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

  /**
   * Extract image from article URL using web scraping
   */
  static async scrapeImageFromUrl(url: string): Promise<ImageSource | null> {
    try {
      // Use a headless browser or simple HTML parsing
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (!response.ok) return null
      
      const html = await response.text()
      
      // Look for Open Graph image first
      const ogImageMatch = html.match(/<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i)
      if (ogImageMatch) {
        return {
          url: ogImageMatch[1],
          source: 'scraped'
        }
      }
      
      // Look for Twitter card image
      const twitterImageMatch = html.match(/<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i)
      if (twitterImageMatch) {
        return {
          url: twitterImageMatch[1],
          source: 'scraped'
        }
      }
      
      // Look for the first large image in the article
      const imgMatches = html.match(/<img[^>]*src=["\']([^"\']+)["\'][^>]*>/gi)
      if (imgMatches) {
        for (const imgMatch of imgMatches) {
          const srcMatch = imgMatch.match(/src=["\']([^"\']+)["\']/)
          if (srcMatch) {
            const imgUrl = srcMatch[1]
            // Skip small images, logos, icons
            if (!imgUrl.includes('logo') && !imgUrl.includes('icon') && !imgUrl.includes('avatar')) {
              return {
                url: this.resolveRelativeUrl(imgUrl, url),
                source: 'scraped'
              }
            }
          }
        }
      }
      
      return null
    } catch (error) {
      console.warn('Failed to scrape image from:', url, error)
      return null
    }
  }

  /**
   * Search for relevant images using Unsplash API based on keywords
   */
  static async searchUnsplashImage(keywords: string[]): Promise<ImageSource | null> {
    if (!this.UNSPLASH_ACCESS_KEY) return null
    
    try {
      const query = keywords.join(' ')
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${this.UNSPLASH_ACCESS_KEY}`
          }
        }
      )
      
      if (!response.ok) return null
      
      const data = await response.json()
      if (data.results && data.results.length > 0) {
        const photo = data.results[0]
        return {
          url: photo.urls.regular,
          width: photo.width,
          height: photo.height,
          source: 'news-api'
        }
      }
      
      return null
    } catch (error) {
      console.warn('Failed to fetch from Unsplash:', error)
      return null
    }
  }

  /**
   * Generate contextual placeholder images
   */
  static generateContextualPlaceholder(title: string, category?: string): ImageSource[] {
    const encodedTitle = encodeURIComponent(title.substring(0, 50))
    const categoryColors = {
      politics: { bg: '2563eb', text: 'ffffff' },
      business: { bg: '059669', text: 'ffffff' },
      technology: { bg: '7c3aed', text: 'ffffff' },
      sports: { bg: 'dc2626', text: 'ffffff' },
      entertainment: { bg: 'ea580c', text: 'ffffff' },
      health: { bg: '0891b2', text: 'ffffff' },
      science: { bg: '4338ca', text: 'ffffff' },
      default: { bg: '64748b', text: 'ffffff' }
    }
    
    const colors = categoryColors[category?.toLowerCase() as keyof typeof categoryColors] || categoryColors.default
    
    return [
      {
        url: `https://via.placeholder.com/800x450/${colors.bg}/${colors.text}?text=${encodedTitle}`,
        width: 800,
        height: 450,
        source: 'generated'
      },
      {
        url: `https://dummyimage.com/800x450/${colors.bg}/${colors.text}&text=${encodedTitle}`,
        width: 800,
        height: 450,
        source: 'generated'
      },
      {
        url: `https://picsum.photos/800/450?random=${Math.abs(this.hashString(title))}`,
        width: 800,
        height: 450,
        source: 'generated'
      }
    ]
  }

  /**
   * Get comprehensive image sources for an article
   */
  static async getImageSources(options: {
    url?: string
    title: string
    keywords?: string[]
    category?: string
    existingImageUrl?: string
  }): Promise<ImageSource[]> {
    const sources: ImageSource[] = []
    
    // Add existing image if valid
    if (options.existingImageUrl && this.isValidImageUrl(options.existingImageUrl)) {
      sources.push({
        url: options.existingImageUrl,
        source: 'scraped'
      })
    }
    
    // Try scraping from article URL
    if (options.url) {
      const scrapedImage = await this.scrapeImageFromUrl(options.url)
      if (scrapedImage) {
        sources.push(scrapedImage)
      }
    }
    
    // Try Unsplash search
    if (options.keywords && options.keywords.length > 0) {
      const unsplashImage = await this.searchUnsplashImage(options.keywords)
      if (unsplashImage) {
        sources.push(unsplashImage)
      }
    }
    
    // Add contextual placeholders
    sources.push(...this.generateContextualPlaceholder(options.title, options.category))
    
    return sources
  }

  private static resolveRelativeUrl(imgUrl: string, baseUrl: string): string {
    try {
      return new URL(imgUrl, baseUrl).href
    } catch {
      return imgUrl
    }
  }

  private static isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false
    const trimmed = url.trim()
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false
    
    try {
      const urlObj = new URL(trimmed)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  private static hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }
}
