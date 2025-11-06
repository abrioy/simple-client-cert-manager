import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Client Certificate Manager",
  description: "Generate mTLS client certificates using step-ca",
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
