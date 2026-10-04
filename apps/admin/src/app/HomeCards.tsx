'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { FiUsers, FiFileText, FiBookOpen, FiUserCheck } from 'react-icons/fi'
import { useAuth } from '@/contentApi/authProvider'
import { canSee } from '@/lib/roles'

interface HomeCard {
    href: string;
    title: string;
    desc: string;
    icon: ReactNode;
    tone: "primary" | "success" | "teal" | "warning";
    roles?: string[];
}

const cards: HomeCard[] = [
    { href: '/content/articles', title: 'İçerik', desc: 'Bilgi-merkezi makalelerini düzenle ve yayınla.', icon: <FiBookOpen size={17} />, tone: 'primary', roles: ['EDITOR'] },
    { href: '/users', title: 'Kullanıcılar', desc: 'Kullanıcıları ara, rolleri yönet.', icon: <FiUsers size={17} />, tone: 'teal', roles: ['SUPPORT', 'FINANCE'] },
    { href: '/coach-applications', title: 'Koçlar', desc: 'Koç sicili: kayıt self servis, buradan durdurabilir ve iddiaları doğrulayabilirsin.', icon: <FiUserCheck size={17} />, tone: 'success', roles: ['SUPER_ADMIN'] },
    { href: '/audit-log', title: 'Audit Log', desc: 'Tüm admin işlemlerinin kaydı (kim/ne/ne zaman).', icon: <FiFileText size={17} />, tone: 'warning', roles: ['SUPER_ADMIN'] },
]

export default function HomeCards() {
    const { admin } = useAuth();
    const visible = cards.filter((c) => canSee(c.roles, admin?.roles));
    if (visible.length === 0) return null;

    return (
        <section className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">Kısayollar</h2>
            <div className="row g-4">
                {visible.map((c) => (
                    <div className="col-xxl-3 col-md-6" key={c.href}>
                        <Link href={c.href} className={`card stretch stretch-full text-decoration-none admin-dashboard-home-card`}>
                            <div className="card-body">
                                <div className="d-flex align-items-center gap-3">
                                    <div className={`avatar-text avatar-xl rounded text-white bg-${c.tone}`}>
                                        {c.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <h5 className="mb-1 text-dark">{c.title}</h5>
                                        <p className="fs-12 text-muted mb-0">{c.desc}</p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </section>
    );
}
