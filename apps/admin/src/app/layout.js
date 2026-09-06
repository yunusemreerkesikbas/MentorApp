import "../assets/scss/theme.scss";
import 'react-circular-progressbar/dist/styles.css';
import "react-perfect-scrollbar/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
import "react-datetime/css/react-datetime.css";
import Script from "next/script";
import { headers } from "next/headers";
import NavigationProvider from "@/contentApi/navigationProvider";
import SettingSideBarProvider from "@/contentApi/settingSideBarProvider";

const themeInitScript = `try{if(localStorage.getItem("skinTheme")==="dark"){document.documentElement.classList.add("app-skin-dark")}}catch{}`;

export const metadata = {
  title: "Mentor | Admin",
  description: "Mentor internal admin panel — team only (§9).",
};

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <Script id="mentor-admin-theme" strategy="beforeInteractive" nonce={nonce}>
          {themeInitScript}
        </Script>
      </head>
      <body>
        <SettingSideBarProvider>
          <NavigationProvider>
            {children}
          </NavigationProvider>
        </SettingSideBarProvider>
      </body>
    </html>
  );
}
