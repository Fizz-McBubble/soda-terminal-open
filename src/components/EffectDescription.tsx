import './EffectDescription.css'

const emphasisPattern = /(\[[^\]\n]+\]|【[^】\n]+】|[+−-]?\d+(?:\.\d+)?[%％]?)/g

export function EffectDescription({ text }: { text: string }) {
  return (
    <span className="effect-description">
      {text
        .split(emphasisPattern)
        .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}
    </span>
  )
}
