interface Props {
  children: React.ReactNode;
  right?: React.ReactNode;
  bare?: boolean;
}

export default function AppShell({ children, right, bare }: Props) {
  return (
    <div className="app-shell">
      {!bare && (
        <header className="app-header">
          <a href="/" className="wordmark">
            Canvas<span className="dot">·</span>Mate
          </a>
          {right && <div className="flex items-center gap-3">{right}</div>}
        </header>
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}
