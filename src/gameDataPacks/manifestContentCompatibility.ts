/** Call only after validating the manifest and matching its package/version identity. */
export function isCompatibleManifestContent(storedHash: string, compiledHash: string) {
  if (storedHash === compiledHash) return true
  // REL-D02 corrected only the 3.2 source labels; adoption, numbers and scope are identical.
  // Keep existing installs readable without rewriting their metadata or player records.
  // Bind both sides so this exception cannot silently extend to a future content revision.
  return (
    compiledHash === 'fnv1a-55673acf' &&
    // 3c886248 briefly coupled the same catalog to avatar cache version 3.1.13.
    // Its game identities, values and scope are unchanged; no database rewrite is needed.
    ['fnv1a-142ef3e7', 'fnv1a-fd1d9bb8'].includes(storedHash)
  )
}
