'use client'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { FiAlignLeft, FiArrowRight, FiMaximize, FiMinimize, FiMoon, FiSun } from "react-icons/fi";
import AdminProfile from './AdminProfile';
import { NavigationContext } from '@/contentApi/navigationProvider';

// Mentor admin header. Trimmed from the Duralux demo: removed the fake search / languages /
// notifications / timesheets / mega-menu. Kept: nav toggles, fullscreen, theme, admin profile.
const Header = () => {
    const { navigationOpen, setNavigationOpen } = useContext(NavigationContext)
    const [navigationExpend, setNavigationExpend] = useState(false)
    const [theme, setTheme] = useState("light")
    const miniButtonRef = useRef(null);
    const expendButtonRef = useRef(null);

    const handleThemeMode = (type) => {
        if (type === "dark") {
            document.documentElement.classList.add("app-skin-dark")
            localStorage.setItem("skinTheme", "dark");
        }
        else {
            document.documentElement.classList.remove("app-skin-dark")
            localStorage.setItem("skinTheme", "light");
        }
        setTheme(type)
    }

    useEffect(() => {
        const handleResize = () => {
            const newWindowWidth = window.innerWidth;
            const down = document.querySelector('.navigation-down-1600');
            const up = document.querySelector('.navigation-up-1600');
            if (newWindowWidth <= 1024) {
                document.documentElement.classList.remove('minimenu');
                if (down) down.style.display = 'none';
            }
            else if (newWindowWidth >= 1025 && newWindowWidth <= 1400) {
                document.documentElement.classList.add('minimenu');
                if (up) up.style.display = 'none';
                if (down) down.style.display = 'block';
            }
            else {
                document.documentElement.classList.remove('minimenu');
                if (up) up.style.display = 'block';
                if (down) down.style.display = 'none';
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        const savedSkinTheme = localStorage.getItem("skinTheme") === "dark" ? "dark" : "light";
        handleThemeMode(savedSkinTheme)

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const handleNavigationExpendUp = (e, pram) => {
        e.preventDefault()
        if (pram === "show") {
            setNavigationExpend(true);
            document.documentElement.classList.add('minimenu')
        }
        else {
            setNavigationExpend(false);
            document.documentElement.classList.remove('minimenu')
        }
    }

    const handleNavigationExpendDown = (e, pram) => {
        e.preventDefault()
        if (pram === "show") {
            setNavigationExpend(true);
            document.documentElement.classList.remove('minimenu')
        }
        else {
            setNavigationExpend(false);
            document.documentElement.classList.add('minimenu')
        }
    }

    const fullScreenMaximize = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
        document.documentElement.classList.add("fsh-infullscreen")
        document.querySelector("body").classList.add("full-screen-helper")
    };

    const fullScreenMinimize = () => {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        document.documentElement.classList.remove("fsh-infullscreen")
        document.querySelector("body").classList.remove("full-screen-helper")
    }

    return (
        <header className="nxl-header">
            <div className="header-wrapper">
                {/* Header left: mobile + desktop navigation toggles */}
                <div className="header-left d-flex align-items-center gap-4">
                    <a href="#" className="nxl-head-mobile-toggler" onClick={(e) => { e.preventDefault(), setNavigationOpen(true) }} id="mobile-collapse">
                        <div className={`hamburger hamburger--arrowturn ${navigationOpen ? "is-active" : ""}`}>
                            <div className="hamburger-box">
                                <div className="hamburger-inner"></div>
                            </div>
                        </div>
                    </a>
                    <div className="nxl-navigation-toggle navigation-up-1600">
                        <a href="#" onClick={(e) => handleNavigationExpendUp(e, "show")} ref={miniButtonRef} style={{ display: navigationExpend ? "none" : "block" }}>
                            <FiAlignLeft size={24} />
                        </a>
                        <a href="#" onClick={(e) => handleNavigationExpendUp(e, "hide")} ref={expendButtonRef} style={{ display: navigationExpend ? "block" : "none" }}>
                            <FiArrowRight size={24} />
                        </a>
                    </div>
                    <div className="nxl-navigation-toggle navigation-down-1600">
                        <a href="#" onClick={(e) => handleNavigationExpendDown(e, "hide")} style={{ display: navigationExpend ? "block" : "none" }}>
                            <FiAlignLeft size={24} />
                        </a>
                        <a href="#" onClick={(e) => handleNavigationExpendDown(e, "show")} style={{ display: navigationExpend ? "none" : "block" }}>
                            <FiArrowRight size={24} />
                        </a>
                    </div>
                </div>
                {/* Header right: fullscreen, theme, admin profile */}
                <div className="header-right ms-auto">
                    <div className="d-flex align-items-center">
                        <div className="nxl-h-item d-none d-sm-flex">
                            <div className="full-screen-switcher">
                                <span className="nxl-head-link me-0">
                                    <FiMaximize size={20} className="maximize" onClick={fullScreenMaximize} />
                                    <FiMinimize size={20} className="minimize" onClick={fullScreenMinimize} />
                                </span>
                            </div>
                        </div>
                        <div className="nxl-h-item dark-light-theme">
                            <button type="button" className="nxl-head-link me-0 dark-button admin-header-icon-button" onClick={() => handleThemeMode("dark")} aria-label="Koyu temayı aç" aria-pressed={theme === "dark"} title="Koyu tema">
                                <FiMoon size={20} />
                            </button>
                            <button type="button" className="nxl-head-link me-0 light-button admin-header-icon-button" onClick={() => handleThemeMode("light")} aria-label="Açık temayı aç" aria-pressed={theme === "light"} title="Açık tema" style={{ display: "none" }}>
                                <FiSun size={20} />
                            </button>
                        </div>
                        <AdminProfile />
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Header
