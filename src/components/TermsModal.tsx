interface TermsModalProps {
  onClose: () => void;
}

export function TermsModal({ onClose }: TermsModalProps) {
  return (
    <div className="terms-overlay" onClick={onClose}>
      <div className="terms-card" onClick={(e) => e.stopPropagation()}>
        <div className="terms-header">
          <h2>Terms</h2>
          <button className="terms-close" onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 10 10">
              <path
                d="M0 0 L10 10 M10 0 L0 10"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
          </button>
        </div>

        <div className="terms-body">
          <p>
            Dusk is provided as-is, free of charge, for personal use. By
            using it you agree to the following:
          </p>
          <ol>
            <li>
              <strong>No redistribution.</strong> You may not redistribute
              this software, in original or compiled (.exe/installer) form,
              through any other website, storefront, or file-sharing
              service. Point people to the official GitHub repository
              instead.
            </li>
            <li>
              <strong>No modified redistribution.</strong> You may fork or
              modify the source for your own personal use, but you may not
              publish, share, or distribute a modified version of Dusk —
              as source or as a built application — under this name or any
              other.
            </li>
            <li>
              <strong>No warranty.</strong> Dusk is provided without any
              warranty of any kind. Modifying Roblox client files is done
              at your own risk; the author is not responsible for any
              account, data, or system issues that result from using it.
            </li>
            <li>
              <strong>Not affiliated with Roblox.</strong> Dusk is an
              independent, unofficial tool and is not created by, affiliated
              with, or endorsed by Roblox Corporation.
            </li>
          </ol>
          <p className="terms-footnote">
            These terms may be updated as the project develops; the version
            published alongside a given release on GitHub is the one that
            applies to it.
          </p>
        </div>
      </div>

      <style>{`
        .terms-overlay {
          position: absolute;
          inset: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.55);
          animation: fade-in 160ms ease both;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .terms-card {
          width: 320px;
          max-height: 420px;
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          border: 1px solid var(--line-strong);
          border-radius: var(--radius-md);
          box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.5);
          animation: reveal-up 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .terms-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          border-bottom: 1px solid var(--line);
          flex-shrink: 0;
        }
        .terms-header h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
        }
        .terms-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          border-radius: 10px;
        }
        .terms-close:hover {
          background: var(--bg-surface-hover);
          color: var(--ink);
        }
        .terms-body {
          padding: 12px 16px 16px;
          overflow-y: auto;
          scrollbar-width: none;
          font-size: 11.5px;
          line-height: 1.6;
          color: var(--ink-muted);
        }
        .terms-body::-webkit-scrollbar {
          display: none;
        }
        .terms-body p {
          margin: 0 0 10px;
        }
        .terms-body ol {
          margin: 0 0 10px;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .terms-body strong {
          color: var(--ink);
        }
        .terms-footnote {
          color: var(--ink-faint);
          font-size: 10.5px;
        }
      `}</style>
    </div>
  );
}
