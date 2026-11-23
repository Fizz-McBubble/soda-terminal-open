import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import releases from "../scanner/installerDownloadMirrors.json";
import { InstallerMirrorLinks } from "./InstallerMirrorLinks";

it.each(["quickRead", "scanner"] as const)(
  "links %s to the published version only",
  (tool) => {
    const { version, sha256, sources } = releases[tool];
    const view = render(
      <InstallerMirrorLinks tool={tool} version={version} sha256={sha256} />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(sources.length);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      sources.map(({ url }) => url),
    );
    for (const link of links) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("target")).toBe("_blank");
    }

    view.rerender(
      <InstallerMirrorLinks tool={tool} version="0.0.0" sha256={sha256} />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    view.rerender(
      <InstallerMirrorLinks tool={tool} version={version} sha256={null} />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  },
);
