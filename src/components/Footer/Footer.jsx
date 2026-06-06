// ── Footer.jsx ────────────────────────────────────────────────────────────────
// Application footer. Minimal — brand identity + attribution.
// Sits at the bottom of the main app layout on all screen sizes.
// On mobile, the sticky CGPA bar sits above this footer.


import React from "react";
import "./Footer.css";


export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">

        {/* Brand */}
        <div className="footer__brand">
          <span className="footer__logo" aria-label="NG CGPA">
            NG <strong>CGPA</strong>
          </span>
          <span className="footer__separator" aria-hidden="true">·</span>
          <span className="footer__tagline">
            Nigerian University CGPA and Grade Point Calculator
          </span>
        </div>

        {/* Attribution */}
        <div className="footer__right">
          <span className="footer__built">
            Built by{" "}
            <span className="footer__author">Nonso [ELUSK]</span>
          </span>
          <span className="footer__separator" aria-hidden="true">·</span>
          <span className="footer__year" aria-label={`Copyright ${year}`}>
            &copy; {year}
          </span>
        </div>

      </div>
    </footer>
  );
}