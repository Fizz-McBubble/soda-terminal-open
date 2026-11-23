import small from './golden-sample/ramiel-user-cutout-576.webp'
import regular from './golden-sample/ramiel-user-cutout-1152.webp'
import large from './golden-sample/ramiel-user-cutout-1536.webp'

export const homeHeroImage = {
  src: regular,
  srcSet: `${small} 576w, ${regular} 1152w, ${large} 1536w`,
  sizes:
    '(max-width: 960px) 90vw, (max-width: 1400px) 530px, (min-width: 1921px) min(36vw, 1035px), 690px',
}

export function preloadHomeHeroImage() {
  if (window.location.pathname !== '/' || document.getElementById('soda-home-hero-preload')) return
  const link = document.createElement('link')
  link.id = 'soda-home-hero-preload'
  link.rel = 'preload'
  link.as = 'image'
  link.imageSrcset = homeHeroImage.srcSet
  link.imageSizes = homeHeroImage.sizes
  link.setAttribute('fetchpriority', 'high')
  document.head.append(link)
}
