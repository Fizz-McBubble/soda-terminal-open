/** Call only after validating the manifest and matching its package/version identity. */
export function isCompatibleManifestContent(storedHash: string, compiledHash: string) {
  if (storedHash === compiledHash) return true
  // REL-D02 corrected only the 3.2 source labels; adoption, numbers and scope are identical.
  // Keep existing installs readable without rewriting their metadata or player records.
  // Bind both sides so this exception cannot silently extend to a future content revision.
  return (
    ['fnv1a-55673acf', 'fnv1a-39f991e1'].includes(compiledHash) &&
    // 3c886248 briefly coupled the same catalog to avatar cache version 3.1.13.
    // Its game identities, values and scope are unchanged; no database rewrite is needed.
    ['fnv1a-142ef3e7', 'fnv1a-fd1d9bb8',
      // R2 corrected only set-34200's player name in the manifest. All coverage
      // identities, release dates, eligibility and upstream SHA256s are unchanged;
      // the scope/adoption digests propagate that label correction.
      ...(compiledHash === 'fnv1a-39f991e1' ? ['fnv1a-55673acf'] : []),
    ].includes(storedHash)
  )
}
