type MainEvidence = { source: string; rule: string }

/**
 * Legacy detail-main OCR preserved truncated integer text (frozen S4 captures and
 * samsaq/ZZZ-Scanner validMetadata.py). Next's versioned cleaner exports rounded
 * whitelist values (StatValueRange.cs). These are producer contracts, not two
 * interchangeable game values. Keep the original evidence and validate one only.
 */
export function scanMainStatDisplayValue(
  base: number,
  level: number,
  maxLevel: number,
  unit: 'flat' | 'percent',
  evidence: MainEvidence | undefined,
) {
  const raw = (base * (maxLevel + 3 * level)) / maxLevel
  if (unit !== 'flat') return raw
  const legacyDetailOcr =
    evidence?.source === 'detail-main' && evidence.rule === 'ocr_name_and_slot_value_rule'
  return legacyDetailOcr ? Math.floor(raw + 1e-9) : Math.round(raw)
}
