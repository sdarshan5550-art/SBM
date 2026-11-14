export interface PageSeoOptions {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  structuredData?: Record<string, unknown>;
}

const SITE_URL = 'https://sbmhotel.com';

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function updatePageSeo(options: PageSeoOptions) {
  const canonicalUrl = `${SITE_URL}${options.path}`;
  document.title = options.title;
  setMeta('name', 'description', options.description);
  setMeta('name', 'robots', options.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', 'SBM Hotels');
  setMeta('property', 'og:title', options.title);
  setMeta('property', 'og:description', options.description);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', options.title);
  setMeta('name', 'twitter:description', options.description);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  const existingSchema = document.getElementById('sbm-page-structured-data');
  if (existingSchema) existingSchema.remove();
  if (options.structuredData) {
    const script = document.createElement('script');
    script.id = 'sbm-page-structured-data';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({ '@context': 'https://schema.org', ...options.structuredData });
    document.head.appendChild(script);
  }
}
