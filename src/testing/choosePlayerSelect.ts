import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/** Exercise the same open/choose interaction as the player. */
export async function choosePlayerSelect(trigger: HTMLElement, value: string) {
  await userEvent.click(trigger)
  const list = screen.getByRole('listbox', { name: trigger.getAttribute('aria-label')! })
  const option = within(list)
    .getAllByRole('option')
    .find((item) => (item as HTMLButtonElement).value === value)
  if (!option) throw new Error(`Missing menu option: ${value}`)
  await userEvent.click(option)
}
