import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-card/40 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
        <div>
          <div className="font-display text-lg font-extrabold text-gradient-hot">CoreCade</div>
          <p className="mt-2 text-sm text-muted-foreground">
            The operating system for gaming cafés.
          </p>
          <div className="mt-4 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">CoreCade Technologies</div>
            <div>Bengaluru, Karnataka, India</div>
            <div className="mt-2">Grievance Officer</div>
            <div>grievance@corecade.in</div>
          </div>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Product</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/discover" className="hover:text-primary">Discover cafés</Link></li>
            <li><Link to="/auth" className="hover:text-primary">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Legal</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/terms" className="hover:text-primary">Terms of Service</Link></li>
            <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
            <li><Link to="/refund-policy" className="hover:text-primary">Refund Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CoreCade Technologies. All rights reserved.
      </div>
    </footer>
  );
}
