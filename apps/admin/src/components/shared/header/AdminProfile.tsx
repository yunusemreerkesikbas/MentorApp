'use client'
import { FiLogOut } from "react-icons/fi";
import { useAuth } from "@/contentApi/authProvider";

// Real admin profile dropdown: shows the signed-in admin (from /users/me) + logout.
// Replaces the Duralux demo ProfileModal.
const AdminProfile = () => {
    const { admin, logout } = useAuth();
    const label = admin?.displayName || admin?.email || "—";
    const initial = label.charAt(0).toUpperCase();

    const avatar = (
        <span
            className="user-avtar me-0 d-inline-flex align-items-center justify-content-center bg-primary text-white rounded-circle"
            style={{ width: 40, height: 40, fontWeight: 600 }}
        >
            {initial}
        </span>
    );

    return (
        <div className="dropdown nxl-h-item">
            <a href="#" data-bs-toggle="dropdown" role="button" data-bs-auto-close="outside">
                {avatar}
            </a>
            <div className="dropdown-menu dropdown-menu-end nxl-h-dropdown nxl-user-dropdown">
                <div className="dropdown-header">
                    <div className="d-flex align-items-center">
                        {avatar}
                        <div className="ms-2">
                            <h6 className="text-dark mb-0">{label}</h6>
                            <span className="fs-12 fw-medium text-muted">{admin?.email ?? ""}</span>
                        </div>
                    </div>
                </div>
                <div className="dropdown-divider"></div>
                <div className="px-3 py-1 fs-12 text-muted">
                    Roller: {admin?.roles?.join(", ") || "—"}
                </div>
                <div className="dropdown-divider"></div>
                <button type="button" className="dropdown-item" onClick={logout}>
                    <i><FiLogOut /></i>
                    <span>Çıkış yap</span>
                </button>
            </div>
        </div>
    );
};

export default AdminProfile;
