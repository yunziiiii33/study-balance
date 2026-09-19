import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공부 저울 — 오늘의 공부 비중",
  description: "오늘 확보한 공부 시간을 과목별 조건에 따라 나눠보세요.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
