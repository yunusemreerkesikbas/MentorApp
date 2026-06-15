'use client'
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { setToken } from "@/lib/auth";

// Admin login (W6). Reuses the single API: POST /v1/auth/login. Admin = a users row holding
// the ADMIN role; in prod the app also sits behind Cloudflare Access (§9). No self-signup.
export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { data } = await apiClient.post<{ accessToken: string }>("/auth/login", { email, password });
            setToken(data.accessToken);
            router.push("/");
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Giriş başarısız. Bilgileri kontrol et.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-minimal-wrapper">
            <div className="auth-minimal-inner">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-xl-4 col-lg-6 col-md-8">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-4 p-sm-5">
                                    <h2 className="fs-20 fw-bolder mb-2">Mentor Admin</h2>
                                    <p className="fs-13 text-muted mb-4">
                                        Ekip girişi — yalnızca yetkili hesaplar (§9).
                                    </p>
                                    {error && <div className="alert alert-danger py-2 fs-12">{error}</div>}
                                    <form onSubmit={onSubmit}>
                                        <div className="mb-3">
                                            <label className="form-label">E-posta</label>
                                            <input
                                                type="email"
                                                className="form-control"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                autoComplete="username"
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label">Şifre</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                autoComplete="current-password"
                                            />
                                        </div>
                                        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                                            {loading ? "Giriş yapılıyor…" : "Giriş yap"}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
