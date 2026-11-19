"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: "32rem", margin: "12vh auto", padding: "1rem", fontFamily: "system-ui" }}>
          <h1>DoubtRoom couldn’t open</h1>
          <p>Reload to return to your study room.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </main>
      </body>
    </html>
  );
}
