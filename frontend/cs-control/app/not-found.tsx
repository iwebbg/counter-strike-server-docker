import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-page">
      <div className="empty-panel">
        <b>404</b>
        <h1>Page not found</h1>
        <Link className="button primary" href="/app">
          Control panel
        </Link>
      </div>
    </main>
  );
}
