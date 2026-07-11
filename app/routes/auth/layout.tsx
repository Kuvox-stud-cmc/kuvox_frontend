import { Link, Outlet } from "react-router";

/** Minimal centered layout for the authentication pages. */
export default function AuthLayout() {
  return (
    <div 
      className="relative flex min-h-screen items-center justify-center bg-surface px-4 py-12 overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(circle at center, rgba(19, 19, 21, 0.4) 0%, rgba(19, 19, 21, 0.8) 100%), url('/Landingpage/1.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Premium ambient light glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-secondary/5 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-[420px] rounded-3xl border border-white/[0.08] bg-surface-container-lowest/65 backdrop-blur-2xl p-8 md:p-10 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in-up">
        <Link to="/" className="flex justify-center transition-transform duration-200 active:scale-95">
          <img src="/logo.svg" alt="Kuvox" className="h-8" />
        </Link>
        <div className="mt-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
