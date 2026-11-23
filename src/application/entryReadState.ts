export type EntryReadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string }

export async function readEntryState<T>(
  read: () => Promise<T>,
  message: string,
): Promise<EntryReadState<T>> {
  try {
    return { status: 'ready', data: await read() }
  } catch {
    // Raw storage errors may contain paths or internal fields; keep player copy bounded.
    return { status: 'error', message }
  }
}
