'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { FiUsers, FiFileText, FiBookOpen } from 'react-icons/fi'
import { useAuth } from '@/contentApi/authProvider'

// Home feature cards, role-gated (mirrors the sidebar): a card with `roles` shows only if the
// signed-in user holds one — so an EDITOR never sees links they can't use.
interface HomeCard {
    href: string;
    title: string;
    desc: string;
    icon: ReactNode;
    roles?: string[];
}

const cards: HomeCard[] = [
    { href: '/content/articles', title: 'İçerik', desc: 'Bilgi-merkezi makalelerini düzenle ve yayınla.', icon: <FiBookOpen size={22} />, roles: ['ADMIN', 'EDITOR'] },
    { href: '/users', title: 'Kullanıcılar', desc: 'Kullanıcıları ara, STAFF rolünü yönet.', icon: <FiUsers size={22} />, roles: ['ADMIN'] },
    { href: '/audit-log', title: 'Audit Log', desc: 'Tüm admin işlemlerinin kaydı (kim/ne/ne zaman).', icon: <FiFileText size={22} />, roles: ['ADMIN'] },
]

export default function HomeCards() {
    const { admin } = useAuth();
    const visible = cards.filter((c) => !c.roles || (admin?.roles ?? []).some((r) => c.roles!.includes(r)));
    return (
        <div className="row g-4">
            {visible.map((c) => (
                <div className="col-xxl-3 col-md-6" key={c.href}>
                    <Link href={c.href} className="card stretch stretch-full text-decoration-none">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3 mb-2">
                                <span className="d-inline-flex align-items-center justify-content-center bg-soft-primary text-primary rounded" style={{ width: 44, height: 44 }}>
                                    {c.icon}
                                </span>
                                <h5 className="mb-0 text-dark">{c.title}</h5>
                            </div>
                            <p className="fs-12 text-muted mb-0">{c.desc}</p>
                        </div>
                    </Link>
                </div>
            ))}
        </div>
    );
}
