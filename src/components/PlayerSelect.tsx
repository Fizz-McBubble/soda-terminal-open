import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { SelectMenu, type SelectMenuOption } from './assets/r6/SelectMenu'

type OptionProps = {
  value?: string | number
  children?: ReactNode
  label?: string
  disabled?: boolean
}

function optionText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<OptionProps>(child) ? optionText(child.props.children) : String(child),
    )
    .join('')
}

function readOptions(
  children: ReactNode,
  group?: string,
  groupDisabled = false,
): SelectMenuOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child)) return []
    if (child.type === Fragment) return readOptions(child.props.children, group, groupDisabled)
    if (child.type === 'optgroup')
      return readOptions(child.props.children, child.props.label, child.props.disabled)
    if (child.type !== 'option') return []
    const label = child.props.label ?? optionText(child.props.children)
    return [
      {
        value: String(child.props.value ?? label),
        label,
        group,
        disabled: groupDisabled || child.props.disabled,
      },
    ]
  })
}

/** Keep one menu implementation for catalogue choices and player filters. */
export function PlayerSelect({
  value,
  children,
  onChange,
  disabled,
  id,
  className,
  'aria-label': label,
}: {
  value: string | number
  children: ReactNode
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  className?: string
  'aria-label': string
}) {
  return (
    <div className={className}>
      <SelectMenu
        id={id}
        role="combobox"
        label={label}
        value={String(value)}
        options={readOptions(children)}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  )
}
