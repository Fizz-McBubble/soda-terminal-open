import mirrorReleases from "../scanner/installerDownloadMirrors.json";

export function InstallerMirrorLinks({
  tool,
  version,
  sha256,
}: {
  tool: keyof typeof mirrorReleases;
  version: string;
  sha256: string | null;
}) {
  const release = mirrorReleases[tool];
  if (version !== release.version || sha256 !== release.sha256) return null;

  return (
    <div className="scanner-installer__feedback scanner-installer__mirrors">
      <span className="scanner-installer__notice">国内下载</span>
      {release.sources.map(({ label, url }) => (
        <a
          key={url}
          className="scanner-installer__fallback"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${release.name} v${version} · ${label} 国内下载`}
        >
          {label}
        </a>
      ))}
    </div>
  );
}
