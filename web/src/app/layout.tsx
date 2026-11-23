import type { Metadata } from "next";
import { Noto_Sans_Myanmar, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "700"],
  variable: "--font-thai",
});

const notoMyanmar = Noto_Sans_Myanmar({
  subsets: ["myanmar"],
  weight: ["400", "700"],
  variable: "--font-myanmar",
});

export const metadata: Metadata = {
  title: "PDF Book Maker",
  description: "Create photo books and export PDFs in the browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${notoThai.variable} ${notoMyanmar.variable}`}>
        {children}
      </body>
    </html>
  );
}