import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router";

function CommunityTopNav() {
  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-container-margin h-toolbar-height bg-surface/80 backdrop-blur-md border-b border-outline-variant/30">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-headline-md font-headline-md font-bold text-primary tracking-tight hover:opacity-80 transition-opacity">
          Kuvox
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <NavLink
            to="/community/forums"
            className={({ isActive }) =>
              `font-body-md text-body-md transition-all duration-200 active:scale-95 ${
                isActive
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-on-surface-variant hover:text-on-surface"
              }`
            }
          >
            Discussions
          </NavLink>
          <NavLink
            to="/community/showcase"
            className={({ isActive }) =>
              `font-body-md text-body-md transition-all duration-200 active:scale-95 ${
                isActive
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-on-surface-variant hover:text-on-surface"
              }`
            }
          >
            Showcase
          </NavLink>
          <NavLink
            to="/community/learn"
            className={({ isActive }) =>
              `font-body-md text-body-md transition-all duration-200 active:scale-95 ${
                isActive
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-on-surface-variant hover:text-on-surface"
              }`
            }
          >
            Learning
          </NavLink>
          <NavLink
            to="/community/news"
            className={({ isActive }) =>
              `font-body-md text-body-md transition-all duration-200 active:scale-95 ${
                isActive
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-on-surface-variant hover:text-on-surface"
              }`
            }
          >
            Updates
          </NavLink>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="material-symbols-outlined text-on-surface-variant hover:bg-white/5 p-2 rounded-full transition-colors">
          notifications
        </button>
        <button className="material-symbols-outlined text-on-surface-variant hover:bg-white/5 p-2 rounded-full transition-colors">
          account_circle
        </button>
        <button className="bg-primary text-on-primary px-4 py-1.5 rounded-lg text-label-mono font-label-mono hover:opacity-90 transition-all duration-200 active:scale-95">
          Join Community
        </button>
      </div>
    </nav>
  );
}

function CommunitySidebar() {
  const navLinks = [
    { to: "/community", label: "Home", icon: "home", exact: true },
    { to: "/community/forums", label: "Discussions", icon: "forum" },
    { to: "/community/showcase", label: "Showcase", icon: "movie_filter" },
    { to: "/community/learn", label: "Learning", icon: "school" },
    { to: "/community/news", label: "Updates", icon: "campaign" },
  ];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 hidden lg:flex flex-col p-panel-padding bg-surface-container border-r border-outline-variant/10 z-40 mt-toolbar-height">
      <div className="mb-8 pt-4">
        <div className="flex items-center gap-3 px-3 mb-6">
          <div className="w-10 h-10 rounded-full border border-outline-variant/30 bg-surface-container-high flex items-center justify-center text-primary font-bold">
            KX
          </div>
          <div>
            <p className="font-headline-sm text-headline-sm text-primary">Kuvox Hub</p>
            <p className="font-label-mono text-label-mono text-on-surface-variant opacity-70">
              AI Creative Community
            </p>
          </div>
        </div>
        <button className="w-full flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-container-highest text-primary py-3 rounded-xl mb-6 transition-colors border border-outline-variant/20">
          <span className="material-symbols-outlined">add</span>
          <span className="font-label-mono text-label-mono">New Post</span>
        </button>
        <nav className="space-y-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-lg group transition-colors ${
                  isActive
                    ? "bg-primary-container/20 text-primary border-r-2 border-primary"
                    : "text-on-surface-variant hover:bg-surface-variant"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined transition-colors ${
                      isActive ? "" : "group-hover:text-primary"
                    }`}
                  >
                    {link.icon}
                  </span>
                  <span className="font-label-mono text-label-mono">{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-auto pb-4 space-y-1 border-t border-outline-variant/10 pt-4">
        <Link
          to="#"
          className="flex items-center gap-4 px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-mono text-label-mono">Settings</span>
        </Link>
        <Link
          to="/help"
          className="flex items-center gap-4 px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined">help</span>
          <span className="font-label-mono text-label-mono">Support</span>
        </Link>
      </div>
    </aside>
  );
}

function CommunityMobileNav() {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-md border-t border-outline-variant/30 px-6 py-3 flex justify-between items-center z-50">
      <NavLink
        to="/community"
        end
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 ${
            isActive ? "text-primary" : "text-on-surface-variant hover:text-primary"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              home
            </span>
            <span className="text-[10px] uppercase font-bold">Home</span>
          </>
        )}
      </NavLink>
      <NavLink
        to="/community/forums"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 ${
            isActive ? "text-primary" : "text-on-surface-variant hover:text-primary"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              forum
            </span>
            <span className="text-[10px] uppercase font-bold">Forum</span>
          </>
        )}
      </NavLink>
      <NavLink
        to="/community/showcase"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 ${
            isActive ? "text-primary" : "text-on-surface-variant hover:text-primary"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              movie_filter
            </span>
            <span className="text-[10px] uppercase font-bold">Work</span>
          </>
        )}
      </NavLink>
      <NavLink
        to="/community/learn"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 ${
            isActive ? "text-primary" : "text-on-surface-variant hover:text-primary"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              school
            </span>
            <span className="text-[10px] uppercase font-bold">Learn</span>
          </>
        )}
      </NavLink>
    </div>
  );
}

function CommunityFooter() {
  return (
    <footer className="w-full py-12 bg-surface-container-lowest border-t border-outline-variant/20 flex flex-col items-center justify-center gap-4 px-container-margin pb-24 lg:pb-12">
      <span className="font-headline-sm text-headline-sm text-on-surface">Kuvox</span>
      <div className="flex gap-8">
        <Link
          to="/terms"
          className="text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100"
        >
          Terms
        </Link>
        <Link
          to="/privacy"
          className="text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100"
        >
          Privacy
        </Link>
        <a
          href="#"
          className="text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100"
        >
          Twitter
        </a>
        <a
          href="#"
          className="text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100"
        >
          Discord
        </a>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant opacity-60">
        © {new Date().getFullYear()} Kuvox AI. Precision Video Editing.
      </p>
    </footer>
  );
}

export default function CommunityLayout() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const cards = document.querySelectorAll('.glass-card');
      cards.forEach((card) => {
        const htmlCard = card as HTMLElement;
        const rect = htmlCard.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (x > 0 && x < rect.width && y > 0 && y < rect.height) {
          htmlCard.style.setProperty('--mouse-x', `${x}px`);
          htmlCard.style.setProperty('--mouse-y', `${y}px`);
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="bg-background text-on-surface font-body-md overflow-x-hidden selection:bg-primary/30 min-h-screen">
      <CommunityTopNav />
      <CommunitySidebar />
      <main className="lg:ml-64 pt-toolbar-height min-h-screen flex flex-col">
        <div className="flex-grow">
          <Outlet />
        </div>
        <CommunityFooter />
      </main>
      <CommunityMobileNav />
    </div>
  );
}
