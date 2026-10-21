import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Chinese Learning",
  description:
    "A little reading. A little repetition. Chinese that stays with you.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "日常" },
  icons: { icon: "/icon.svg?v=zhong", apple: "/apple-icon.png?v=zhong" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5ef",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
