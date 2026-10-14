'use client'
import React, { useContext, useEffect } from 'react'
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import PerfectScrollbar from "react-perfect-scrollbar";
import Menus from './Menus';
import { NavigationContext } from '@/contentApi/navigationProvider';

const NavigationManu = () => {
    const { navigationOpen, setNavigationOpen } = useContext(NavigationContext)
    const pathName = usePathname()
    useEffect(() => {
        setNavigationOpen(false)
    }, [pathName])
    return (
        <nav className={`nxl-navigation ${navigationOpen ? "mob-navigation-active" : ""}`}>
            <div className="navbar-wrapper">
                <div className="m-header">
                    <Link href="/" className="b-brand">
                        {/* PuhuKoç logo (DESIGN.md §8.7), rendered from the web's Logo; the eye when collapsed. */}
                        <img src="/images/puhukoc/puhukoc-wordmark.png" alt="PuhuKoç" height="28" className="logo logo-lg" />
                        <img src="/images/puhukoc/puhukoc-icon.svg" alt="PuhuKoç" width="32" height="32" className="logo logo-sm" />
                    </Link>
                </div>

                <div className={`navbar-content`}>
                    <PerfectScrollbar>
                        <ul className="nxl-navbar">
                            <li className="nxl-item nxl-caption">
                                <label>Yönetim</label>
                            </li>
                            <Menus />
                        </ul>
                        <div style={{ height: "18px" }}></div>
                    </PerfectScrollbar>
                </div>
            </div>
            <div onClick={() => setNavigationOpen(false)} className={`${navigationOpen ? "nxl-menu-overlay" : ""}`}></div>
        </nav>
    )
}

export default NavigationManu