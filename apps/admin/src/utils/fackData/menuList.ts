// Mentor admin menu (W6). Trimmed from the Duralux CRM demo to the lean admin surface (§9):
// the demo CRM/applications pages still exist in the repo as UX reference but are off-menu.
// `roles` gates visibility (Menus filters by the signed-in user's roles); omitted = everyone in.
export interface MenuItem {
    id: number;
    name: string;
    path: string;
    icon: string;
    dropdownMenu: false;
    roles?: string[];
}

export const menuList: MenuItem[] = [
    {
        id: 0,
        name: "Panel",
        path: "/",
        icon: "feather-grid",
        dropdownMenu: false,
    },
    {
        id: 4,
        name: "İçerik",
        path: "/content/articles",
        icon: "feather-book-open",
        dropdownMenu: false,
        roles: ["EDITOR"],
    },
    {
        id: 5,
        name: "Sınav Takvimi",
        path: "/content/exams",
        icon: "feather-calendar",
        dropdownMenu: false,
        roles: ["EDITOR"],
    },
    {
        id: 1,
        name: "Kullanıcılar",
        path: "/users",
        icon: "feather-users",
        dropdownMenu: false,
        roles: ["SUPPORT", "FINANCE"],
    },
    {
        id: 6,
        name: "Topluluk",
        path: "/forum",
        icon: "feather-message-circle",
        dropdownMenu: false,
        roles: ["SUPER_ADMIN", "ADMIN", "EDITOR"],
    },
    {
        id: 7,
        name: "Planlar",
        path: "/plans",
        icon: "feather-credit-card",
        dropdownMenu: false,
        roles: ["FINANCE"],
    },
    {
        id: 9,
        name: "Kampanyalar",
        path: "/promotions",
        icon: "feather-tag",
        dropdownMenu: false,
        roles: ["FINANCE"],
    },
    {
        id: 8,
        name: "Duyurular",
        path: "/announcements",
        icon: "feather-bell",
        dropdownMenu: false,
        roles: ["SUPER_ADMIN"],
    },
    {
        id: 2,
        name: "İşlem Geçmişi",
        path: "/audit-log",
        icon: "feather-file-text",
        dropdownMenu: false,
        roles: ["SUPER_ADMIN"],
    },
    {
        id: 3,
        name: "Ayarlar",
        path: "/config",
        icon: "feather-sliders",
        dropdownMenu: false,
        roles: ["SUPER_ADMIN"],
    },
];
