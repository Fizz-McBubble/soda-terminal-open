const officialArtwork =
  'https://i0.hdslb.com/bfs/new_dyn/e765df9cd60e5179c642391004d66c401636034895.png'
const small = `${officialArtwork}@640w.webp`
const regular = `${officialArtwork}@1200w.webp`

export const homeHeroImage = {
  src: regular,
  srcSet: `${small} 640w, ${regular} 1200w`,
  sizes:
    '(max-width: 960px) 90vw, (max-width: 1400px) 540px, (min-width: 1921px) min(38vw, 820px), 600px',
}

export function preloadHomeHeroImage() {
  if (window.location.pathname !== '/' || document.getElementById('soda-home-hero-preload')) return
  const link = document.createElement('link')
  link.id = 'soda-home-hero-preload'
  link.rel = 'preload'
  link.as = 'image'
  link.imageSrcset = homeHeroImage.srcSet
  link.imageSizes = homeHeroImage.sizes
  link.referrerPolicy = 'no-referrer'
  link.setAttribute('fetchpriority', 'high')
  document.head.append(link)
}
