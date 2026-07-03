import React, { useState, useEffect } from "react";
import { cn } from "~/lib/utils";

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Studio", href: "#studio" },
  { label: "Resources", href: "#resources" },
  { label: "Contact", href: "#contact" },
];

export function GlassNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500",
        scrolled ? "top-4" : "top-6"
      )}
    >
      <div className="glass-nav px-2 py-2 flex items-center gap-1">
        {/* Logo */}
        <a href="#" className="px-4 py-2 flex items-center gap-2">
          <span className="text-xl font-semibold tracking-tight text-white">
            KUVOX
          </span>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:block">
          <a
            href="#try"
            className="ml-2 px-5 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors duration-200"
          >
            Try Free
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-white/70 hover:text-white"
          aria-label="Toggle menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {mobileMenuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full mt-2 left-1/2 -translate-x-1/2 glass-nav p-4 flex flex-col gap-2 min-w-[200px]">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-4 py-3 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a
            href="#try"
            className="mt-2 px-5 py-3 bg-white text-black text-sm font-medium rounded-full text-center hover:bg-white/90 transition-colors duration-200"
            onClick={() => setMobileMenuOpen(false)}
          >
            Try Free
          </a>
        </div>
      )}
    </nav>
  );
}
