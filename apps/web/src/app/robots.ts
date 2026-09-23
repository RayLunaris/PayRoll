import type { MetadataRoute } from 'next'

// Internal payroll app — keep search engines out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
