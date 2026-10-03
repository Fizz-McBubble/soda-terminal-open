/** Call only after validating the manifest and matching its package/version identity. */
export function isCompatibleManifestContent(storedHash: string, compiledHash: string) {
  if (storedHash === compiledHash) return true
  // REL-D02 corrected only the 3.2 source labels; adoption, numbers and scope are identical.
  // Keep existing installs readable without rewriting their metadata or player records.
  // Bind both sides so this exception cannot silently extend to a future content revision.
  return compiledHash === 'fnv1a-55673acf' && storedHash === 'fnv1a-142ef3e7'
}
