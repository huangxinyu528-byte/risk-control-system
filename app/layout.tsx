import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "众程建材客户风险管理系统",
  description: "用于客户、合同、账款与风控记录管理的企业后台系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
