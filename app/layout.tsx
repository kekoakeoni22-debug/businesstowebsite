import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Business Finder",
  description: "Find local businesses — optionally only those without a website.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
