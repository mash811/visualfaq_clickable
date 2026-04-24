import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Flipbook — visual knowledge explorer",
  description:
    "Type a topic, get an illustrated explanation, and click into any element to dive deeper.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
