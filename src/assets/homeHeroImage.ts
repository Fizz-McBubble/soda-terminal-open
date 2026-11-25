export const homeHeroImage = {
  src: 'https://fastcdn.mihoyo.com/content-v2/nap/166978/2610c60c1a72180954cd120384f2e65a_4682761660038904596.png',
}

export function preloadHomeHeroImage() {
  if (window.location.pathname !== '/' || document.getElementById('soda-home-hero-preload')) return
  const link = document.createElement('link')
  link.id = 'soda-home-hero-preload'
  link.rel = 'preload'
  link.as = 'image'
  link.href = homeHeroImage.src
  link.referrerPolicy = 'no-referrer'
  link.setAttribute('fetchpriority', 'high')
  document.head.append(link)
}
