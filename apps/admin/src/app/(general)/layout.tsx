import type { ReactNode } from "react";
import AdminShell from "@/components/shared/AdminShell";

const layout = ({ children }: { children: ReactNode }) => <AdminShell>{children}</AdminShell>;

export default layout;
