import { homeHeroImage } from '../assets/homeHeroImage'

export function HomeHeroScene() {
  return (
    <figure className="home-scene" data-art-emphasis="cross-layer-large">
      <span className="home-scene__orbit home-scene__orbit--one" aria-hidden="true" />
      <span className="home-scene__orbit home-scene__orbit--two" aria-hidden="true" />
      <img
        className="home-version-hero"
        src={homeHeroImage.src}
        srcSet={homeHeroImage.srcSet}
        sizes={homeHeroImage.sizes}
        width={1600}
        height={1200}
        fetchPriority="high"
        decoding="async"
        referrerPolicy="no-referrer"
        alt="挽昼版本主视觉"
        draggable="false"
      />
    </figure>
  )
}

export function HomeLoading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="soda-home soda-home--golden">
      <section className="home-focus" aria-busy="true">
        <div className="focus-copy" role="status">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <HomeHeroScene />
      </section>
    </div>
  )
}
