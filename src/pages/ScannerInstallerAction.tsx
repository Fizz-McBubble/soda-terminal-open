import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Check, Download, X } from "lucide-react";
import {
  scannerDistributionManifest,
  type ScannerDistributionSnapshot,
} from "../scanner/distribution";
import {
  createInstallerDownloadFeedbackReport,
  downloadScannerInstaller,
  installerDownloadFailureDetails,
  type InstallerTransferProgress,
} from "../scanner/installerDownload";
import {
  installerTransferStatus,
  installerOutcomeMessage,
} from "../scanner/installerTransferStatus";
import {
  readInstallerRelease,
  type InstallerRelease,
} from "../scanner/installerRelease";
import "./scanner-installer-action.css";
import { compareToolVersion } from "../scanner/toolUpgradeNotice";
import { ScannerPreparationStatus } from "./ScannerPreparationStatus";
import { InstallerMirrorLinks } from "./InstallerMirrorLinks";

type DownloadState =
  | "idle"
  | "downloading"
  | "saving"
  | "save_requested"
  | "error"
  | "cancelled";

export function ScannerInstallerAction({
  distribution,
  issueCode,
  onConnect,
  connectionBlocked = false,
  onAttentionChange,
  upgradeNotice,
}: {
  distribution: ScannerDistributionSnapshot;
  issueCode?: string;
  onConnect?: () => void | Promise<void>;
  connectionBlocked?: boolean;
  onAttentionChange?: (active: boolean) => void;
  upgradeNotice?: string | null;
}) {
  const [state, setState] = useState<DownloadState>("idle");
  const publishStatus = useContext(ScannerPreparationStatus);
  const [bytes, setBytes] = useState(0);
  const [transfer, setTransfer] = useState<InstallerTransferProgress | null>(
    null,
  );
  const [timedOut, setTimedOut] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [release, setRelease] = useState<InstallerRelease | null>(null);
  const [feedbackReport, setFeedbackReport] = useState<ReturnType<
    typeof createInstallerDownloadFeedbackReport
  > | null>(null);
  const downloadButton = useRef<HTMLButtonElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement | null>(null);
  const restoreDownloadFocus = useRef(false);
  const request = useRef<AbortController | null>(null);
  const connectPending = useRef(false);
  const completedDownload = useRef(false);
  const leftAfterDownload = useRef(false);
  const autoConnectAttempted = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
      completedDownload.current = false;
    };
  }, []);
  const pending = state === "downloading" || state === "saving";
  const complete = state === "save_requested";
  const expectedSize = release?.size ?? scannerDistributionManifest.helper.size;
  const installerVersion =
    release?.version ?? scannerDistributionManifest.helper.installerVersion;
  const versionDescription = `画面扫描安装包 v${installerVersion}`;
  useEffect(() => {
    onAttentionChange?.(state !== "idle");
    return () => onAttentionChange?.(false);
  }, [onAttentionChange, state]);
  const percent = Math.min(100, Math.floor((bytes / expectedSize) * 100));
  const progressText =
    state === "saving" ? "正在准备文件" : `下载中 ${percent}%`;
  useEffect(() => {
    if (!pending && restoreDownloadFocus.current) {
      restoreDownloadFocus.current = false;
      downloadButton.current?.focus({ preventScroll: true });
    }
  }, [pending]);
  const update = Boolean(
    distribution.state === "update_available" ||
    compareToolVersion(
      distribution.installedVersion,
      distribution.targetVersion,
    ) === -1 ||
    upgradeNotice ||
    issueCode === "helper_incompatible",
  );
  const repair =
    distribution.state === "repair_required" ||
    issueCode === "runtime_repair_required";
  const connect = useCallback(async () => {
    if (connectionBlocked || connectPending.current || !onConnect) return;
    connectPending.current = true;
    autoConnectAttempted.current = true;
    setConnectionNotice("");
    try {
      await onConnect();
    } catch {
      if (mounted.current) setConnectionNotice("启动画面扫描后点击连接");
    } finally {
      connectPending.current = false;
    }
  }, [connectionBlocked, onConnect]);

  useLayoutEffect(() => {
    if (!complete || !onConnect) return;
    const left = () => {
      if (completedDownload.current) leftAfterDownload.current = true;
    };
    const returned = () => {
      if (
        !completedDownload.current ||
        !leftAfterDownload.current ||
        connectionBlocked ||
        autoConnectAttempted.current ||
        connectPending.current
      )
        return;
      autoConnectAttempted.current = true;
      void connect();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") left();
      else returned();
    };
    window.addEventListener("blur", left);
    window.addEventListener("focus", returned);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      window.removeEventListener("blur", left);
      window.removeEventListener("focus", returned);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [complete, connectionBlocked, onConnect, connect]);

  async function download() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    completedDownload.current = false;
    const current = () => mounted.current && request.current === controller;
    const startedAt = performance.now();
    const readRelease = async () => {
      const deadline = setTimeout(
        () =>
          controller.abort(
            new DOMException("download_timeout", "TimeoutError"),
          ),
        60 * 1000,
      );
      try {
        return await readInstallerRelease(controller.signal);
      } finally {
        clearTimeout(deadline);
      }
    };
    setState("downloading");
    setBytes(0);
    setTransfer(null);
    setTimedOut(false);
    setConnectionNotice("");
    setFeedbackReport(null);
    leftAfterDownload.current = false;
    autoConnectAttempted.current = false;
    let activeRelease: InstallerRelease | null = release;
    try {
      activeRelease = await readRelease();
      if (!current()) return;
      setRelease(activeRelease);
      let result: Awaited<ReturnType<typeof downloadScannerInstaller>>;
      for (let recovery = 0; ; recovery += 1) {
        try {
          result = await downloadScannerInstaller({
            url: activeRelease.downloadUrl,
            fileName: activeRelease.fileName,
            expectedSize: activeRelease.size,
            expectedSha256: activeRelease.sha256,
            signal: controller.signal,
            onProgress: (received) => {
              if (current()) setBytes(received);
            },
            onTransfer: (progress) => {
              if (current()) setTransfer(progress);
            },
            onSaving: () => {
              if (current()) setState("saving");
            },
          });
          break;
        } catch (error) {
          const details = installerDownloadFailureDetails(error);
          if (
            recovery > 0 ||
            details?.code !== "installer_download_release_changed" ||
            controller.signal.aborted
          )
            throw error;
          const refreshed = await readRelease();
          if (!current()) return;
          if (
            refreshed.version === activeRelease.version &&
            refreshed.size === activeRelease.size &&
            refreshed.sha256 === activeRelease.sha256
          )
            throw error;
          activeRelease = refreshed;
          setRelease(refreshed);
          setBytes(0);
          setTransfer(null);
        }
      }
      if (current()) {
        completedDownload.current = true;
        restoreDownloadFocus.current =
          document.activeElement === cancelButton.current;
        setState(result);
      }
    } catch (error) {
      if (!current()) return;
      const failure = installerDownloadFailureDetails(error);
      const timeout =
        failure?.code === "installer_download_timeout" ||
        (error instanceof DOMException && error.name === "TimeoutError");
      const cancelled =
        !timeout &&
        (controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError"));
      restoreDownloadFocus.current =
        document.activeElement === cancelButton.current;
      setTimedOut(timeout);
      setState(cancelled ? "cancelled" : "error");
      if (!cancelled) {
        const expected =
          activeRelease ?? release ?? scannerDistributionManifest.helper;
        setFeedbackReport(
          createInstallerDownloadFeedbackReport({
            tool: "screen_scanner_installer",
            installerVersion:
              "installerVersion" in expected
                ? expected.installerVersion
                : expected.version,
            expectedSize: expected.size,
            expectedSha256: expected.sha256,
            durationMs: performance.now() - startedAt,
            error,
          }),
        );
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  const message =
    connectionNotice ||
    installerOutcomeMessage(state, timedOut) ||
    upgradeNotice ||
    (update && distribution.message.includes("有新版本")
      ? distribution.message
      : "");
  const hidden =
    scannerDistributionManifest.runtime.releaseState !== "published" ||
    (distribution.state === "ready" && !update && !pending);
  const transferText =
    state === "downloading" && transfer
      ? installerTransferStatus(transfer)
      : progressText;
  const preparationMessage = hidden ? "" : pending ? transferText : message;
  const feedbackHref = feedbackReport
    ? `/installer-feedback#${encodeURIComponent(JSON.stringify(feedbackReport))}`
    : null;
  useEffect(() => {
    publishStatus?.({ text: preparationMessage, pending });
    return () => publishStatus?.({ text: "", pending: false });
  }, [publishStatus, preparationMessage, pending]);
  if (hidden) return null;

  return (
    <div className="scanner-installer">
      <div
        className={`scanner-installer__control${pending ? " is-pending" : ""}${complete ? " is-complete" : ""}`}
      >
        <button
          ref={downloadButton}
          className="button button--quiet scanner-prepare__download"
          type="button"
          onClick={() => void download()}
          disabled={pending}
          aria-description={versionDescription}
          title={versionDescription}
        >
          {complete ? (
            <Check aria-hidden="true" size={16} />
          ) : (
            <Download aria-hidden="true" size={17} />
          )}
          <span>
            {pending
              ? progressText
              : complete
                ? "重新下载"
                : update
                  ? "更新画面扫描"
                  : repair
                    ? "修复画面扫描"
                    : "下载画面扫描"}
          </span>
          {!pending ? (
            <small className="scanner-installer__version" aria-hidden="true">
              v{installerVersion}
            </small>
          ) : null}
        </button>
        {pending ? (
          <>
            <progress
              className="scanner-installer__progress"
              aria-label="画面扫描下载进度"
              aria-valuetext={`${progressText} · ${transferText}`}
              value={bytes}
              max={expectedSize}
            />
            <button
              ref={cancelButton}
              className="scanner-installer__cancel"
              type="button"
              aria-label="取消下载"
              title="取消下载"
              onClick={() => {
                restoreDownloadFocus.current =
                  document.activeElement === cancelButton.current;
                request.current?.abort();
              }}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </>
        ) : null}
      </div>
      {!pending && (
        <InstallerMirrorLinks
          tool="scanner"
          version={installerVersion}
          sha256={release?.sha256 ?? scannerDistributionManifest.helper.sha256}
        />
      )}
      {(feedbackHref || preparationMessage) && !publishStatus ? (
        <div className="scanner-installer__feedback" role="status">
          <span className="scanner-installer__notice">
            {preparationMessage}
          </span>
          {feedbackHref ? (
            <a className="scanner-installer__fallback" href={feedbackHref}>
              报告下载问题
            </a>
          ) : null}
        </div>
      ) : feedbackHref ? (
        <div className="scanner-installer__feedback">
          <a className="scanner-installer__fallback" href={feedbackHref}>
            报告下载问题
          </a>
        </div>
      ) : null}
    </div>
  );
}
