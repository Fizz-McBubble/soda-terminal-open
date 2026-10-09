import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { VisualAssetConsumer } from '../../../assets/visualAssetSlots'
import { fitFloatingLayer, getEffectiveZoom } from '../../floatingLayerGeometry'

const VisualEntityImage =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : (await import('../../VisualEntityImage')).VisualEntityImage

export type SelectMenuOption = {
  value: string
  label: string
  group?: string
  disabled?: boolean
  visual?: {
    entityId: string
    name: string
    consumer?: VisualAssetConsumer
  }
}

export function SelectMenu({
  label,
  value,
  options,
  onChange,
  selectedLabel,
  disabled = false,
  id,
  role,
}: {
  label: string
  value: string
  options: SelectMenuOption[]
  onChange: (value: string) => void
  selectedLabel?: string
  disabled?: boolean
  id?: string
  role?: 'combobox'
}) {
  const [open, setOpen] = useState(false)
  const [previousDisabled, setPreviousDisabled] = useState(disabled)
  if (previousDisabled !== disabled) {
    setPreviousDisabled(disabled)
    if (disabled) setOpen(false)
  }
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>()
  const [portalContext, setPortalContext] = useState<{
    target: HTMLElement
    inDialog: boolean
  }>()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const typeahead = useRef({ text: '', time: 0 })
  const current = options.find((option) => option.value === value)
  const groups = [...new Set(options.map((option) => option.group).filter(Boolean))]
  const ungrouped = options.filter((option) => !option.group)
  const orderedOptions = [
    ...ungrouped,
    ...groups.flatMap((group) => options.filter((option) => option.group === group)),
  ]
  const enabledOptions = orderedOptions.filter((option) => !option.disabled)
  const enabledOptionCount = enabledOptions.length
  const menuPositionReady = Boolean(menuStyle)
  const updateMenuPosition = useCallback(() => {
    const bounds = trigger.current?.getBoundingClientRect()
    if (!bounds || !portalContext) return
    const scale = getEffectiveZoom(trigger.current)
    const desiredHeight = Math.min(360, Math.max(132, enabledOptionCount * 48 + 44)) * scale
    const labelWidth = Math.min(
      360,
      Math.max(120, ...options.map((option) => option.label.length * 14 + 56)),
    )
    setMenuStyle({
      ...fitFloatingLayer({
        anchor: bounds,
        width: Math.max(bounds.width, labelWidth * scale),
        height: desiredHeight,
        scale,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        minimumHeight: 220 * scale,
      }),
      // Body portals need the trigger's zoom; dialog portals already inherit it.
      zoom: scale / getEffectiveZoom(portalContext.target),
    })
  }, [enabledOptionCount, options, portalContext])

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      const target = event.target as Node
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  useEffect(() => {
    if (!open || !portalContext?.inDialog) return
    const dialog = root.current?.closest('dialog')
    if (!dialog) return
    dialog.dataset.selectMenuOpen = 'true'
    const keepDialogOpen = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      window.requestAnimationFrame(() => trigger.current?.focus())
    }
    dialog.addEventListener('cancel', keepDialogOpen)
    return () => {
      dialog.removeEventListener('cancel', keepDialogOpen)
      window.setTimeout(() => delete dialog.dataset.selectMenuOpen, 0)
    }
  }, [open, portalContext])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    const reposition = () => updateMenuPosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(reposition) : null
    if (trigger.current) observer?.observe(trigger.current)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      observer?.disconnect()
    }
  }, [open, options.length, updateMenuPosition])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const enabledMenuOptions = menu.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]:not(:disabled)',
    )
    enabledMenuOptions?.[activeIndex]?.focus()
  }, [activeIndex, open, menuPositionReady, portalContext])

  const openMenu = () => {
    if (disabled) return
    const dialog = root.current?.closest('dialog')
    setPortalContext({
      target: dialog?.querySelector('form') ?? dialog ?? document.body,
      inDialog: Boolean(dialog),
    })
    const currentIndex = enabledOptions.findIndex((option) => option.value === value)
    setActiveIndex(currentIndex >= 0 ? currentIndex : 0)
    setOpen(true)
  }

  const moveActive = (direction: 1 | -1) => {
    if (!enabledOptions.length) return
    setActiveIndex((index) => {
      const start = index < 0 ? (direction === 1 ? -1 : 0) : index
      return (start + direction + enabledOptions.length) % enabledOptions.length
    })
  }

  const findTypedOption = (key: string, now: number) => {
    const previous = now - typeahead.current.time < 700 ? typeahead.current.text : ''
    const text = (previous + key).toLocaleLowerCase()
    typeahead.current = { text, time: now }
    const index = enabledOptions.findIndex((option) =>
      option.label.toLocaleLowerCase().startsWith(text),
    )
    if (index >= 0) {
      if (!open) openMenu()
      setActiveIndex(index)
    }
  }

  const renderOption = (option: SelectMenuOption) => (
    <button
      key={option.value}
      type="button"
      role="option"
      value={option.value}
      aria-selected={option.value === value}
      disabled={option.disabled}
      tabIndex={option.disabled ? -1 : option.value === enabledOptions[activeIndex]?.value ? 0 : -1}
      onClick={() => {
        if (option.disabled) return
        onChange(option.value)
        setOpen(false)
        trigger.current?.focus()
      }}
    >
      <span className="filter-select__option-copy">
        {option.visual && VisualEntityImage ? (
          <span className="filter-select__visual" aria-hidden="true">
            <VisualEntityImage
              consumer={option.visual.consumer ?? 'box.team-workspace'}
              entityId={option.visual.entityId}
              entityType="wengine"
              name={option.visual.name}
              slotId="wengine.equipment-icon"
            />
          </span>
        ) : null}
        <span>{option.label}</span>
      </span>
      {option.value === value && <Check aria-hidden="true" size={14} strokeWidth={2.5} />}
    </button>
  )

  return (
    <div className="filter-select select-menu f5v-select-menu" ref={root}>
      <button
        ref={trigger}
        id={id}
        role={role}
        disabled={disabled}
        type="button"
        value={value}
        className="filter-select__trigger"
        aria-label={label}
        title={selectedLabel ?? current?.label}
        aria-controls={open && !disabled ? menuId : undefined}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) openMenu()
            else moveActive(event.key === 'ArrowDown' ? 1 : -1)
          } else if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          } else if (
            event.key.length === 1 &&
            event.key.trim() &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
          ) {
            event.preventDefault()
            findTypedOption(event.key, event.timeStamp)
          }
        }}
      >
        <span className="filter-select__option-copy">
          {current?.visual && VisualEntityImage ? (
            <span className="filter-select__visual" aria-hidden="true">
              <VisualEntityImage
                consumer={current.visual.consumer ?? 'box.team-workspace'}
                entityId={current.visual.entityId}
                entityType="wengine"
                name={current.visual.name}
                slotId="wengine.equipment-icon"
              />
            </span>
          ) : null}
          <span>{selectedLabel ?? current?.label ?? '请选择'}</span>
        </span>
        <ChevronDown aria-hidden="true" size={15} strokeWidth={2.2} />
      </button>
      {open && !disabled && menuStyle && portalContext
        ? createPortal(
            <div
              className={`filter-select__menu select-menu__popover f5v-select-menu-popover${
                portalContext.inDialog ? ' f5v-select-menu-popover--dialog' : ''
              }`}
              id={menuId}
              ref={menu}
              role="listbox"
              aria-label={label}
              style={menuStyle}
              onKeyDown={(event) => {
                if (event.key === 'Tab') {
                  const anchor = trigger.current
                  const scope = anchor?.closest('dialog[open]') ?? document.body
                  const candidates = [
                    ...scope.querySelectorAll<HTMLElement>(
                      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]',
                    ),
                  ]
                    .filter((element) => {
                      if (
                        (element.tabIndex < 0 &&
                          (!element.matches('details > summary:first-of-type') ||
                            element.hasAttribute('tabindex'))) ||
                        element.matches(':disabled') ||
                        menu.current?.contains(element)
                      )
                        return false
                      if (element.closest('[hidden], [inert], dialog:not([open])')) return false
                      for (
                        let parent: HTMLElement | null = element;
                        parent;
                        parent = parent.parentElement
                      ) {
                        if (
                          parent instanceof HTMLDetailsElement &&
                          !parent.open &&
                          !parent.querySelector(':scope > summary')?.contains(element)
                        )
                          return false
                        const style = window.getComputedStyle(parent)
                        if (style.display === 'none' || style.visibility === 'hidden') return false
                      }
                      return true
                    })
                    .sort((a, b) => {
                      const aOrder = a.tabIndex > 0 ? a.tabIndex : Infinity
                      const bOrder = b.tabIndex > 0 ? b.tabIndex : Infinity
                      return aOrder === bOrder ? 0 : aOrder - bOrder
                    })
                  const index = anchor ? candidates.indexOf(anchor) : -1
                  const next = candidates[index + (event.shiftKey ? -1 : 1)]
                  setOpen(false)
                  if (index >= 0 && next) {
                    event.preventDefault()
                    next.focus()
                  } else {
                    anchor?.focus()
                  }
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  if (portalContext.inDialog) {
                    window.setTimeout(() => {
                      setOpen(false)
                      trigger.current?.focus()
                    }, 0)
                  } else {
                    setOpen(false)
                    trigger.current?.focus()
                  }
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  moveActive(1)
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  moveActive(-1)
                } else if (event.key === 'Home') {
                  event.preventDefault()
                  setActiveIndex(0)
                } else if (event.key === 'End') {
                  event.preventDefault()
                  setActiveIndex(Math.max(0, enabledOptions.length - 1))
                } else if (
                  event.key.length === 1 &&
                  event.key.trim() &&
                  !event.altKey &&
                  !event.ctrlKey &&
                  !event.metaKey
                ) {
                  event.preventDefault()
                  findTypedOption(event.key, event.timeStamp)
                }
              }}
            >
              {ungrouped.map(renderOption)}
              {groups.map((group) => (
                <div className="filter-select__group" key={group} role="group" aria-label={group}>
                  <strong>{group}</strong>
                  {options.filter((option) => option.group === group).map(renderOption)}
                </div>
              ))}
            </div>,
            portalContext.target,
          )
        : null}
    </div>
  )
}
