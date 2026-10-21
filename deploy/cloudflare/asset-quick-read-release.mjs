import release from "../../src/assetQuickRead/releaseManifest.json" with { type: "json" };

export const assetQuickReadInstallerPath =
  "/downloads/Soda-Asset-Quick-Read-Setup.exe";
export const assetQuickReadInstallerRelease = release;
export const assetQuickReadInstallerUrl =
  "https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.9/SodaTerminal-AssetReader-Setup-1.1.9.exe";
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === "1.1.9" &&
    manifest.bridgeVersion === "1.0.12" &&
    manifest.releaseTag === "v1.1.9" &&
    manifest.repo === "Fizz-McBubble/soda-terminal-asset-quick-read" &&
    manifest.fileName === "SodaTerminal-AssetReader-Setup-1.1.9.exe" &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 100125372 &&
    manifest.sha256 ===
      "02ec8b0eb6e61119e7e04da7172e1457007435aaece1a54b2aa7a926512ca1c5"
  );
}
