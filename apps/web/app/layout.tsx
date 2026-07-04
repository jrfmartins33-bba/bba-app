import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BBA Platform",
  description: "Portal operacional para clientes BBA Brazil",
  icons: {
    icon: "/bba-logo.png",
    apple: "/bba-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
