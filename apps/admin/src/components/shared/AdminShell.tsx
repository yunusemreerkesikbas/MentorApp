'use client'
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Header from "@/components/shared/header/Header";
import NavigationManu from "@/components/shared/navigationMenu/NavigationMenu";
import useBootstrapUtils from "@/hooks/useBootstrapUtils";
import AuthProvider, { useAuth } from "@/contentApi/authProvider";

// The protected admin shell: header + sidebar, gated by the admin session. Used by every
// authenticated route (the `(general)` group layout and the root "/" page).
function ShellInner({ children }: { children: ReactNode }) {
    const pathName = usePathname();
    useBootstrapUtils(pathName);
    const { loading, admin } = useAuth();

    if (loading) {
        return (
            <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
                <span className="text-muted">Yükleniyor…</span>
            </div>
        );
    }
    // Not authorized → AuthProvider already redirected to /login; render nothing meanwhile.
    if (!admin) return null;

    return (
        <>
            <Header />
            <NavigationManu />
            <main className="nxl-container">
                <div className="nxl-content">{children}</div>
            </main>
        </>
    );
}

export default function AdminShell({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            <ShellInner>{children}</ShellInner>
        </AuthProvider>
    );
}
