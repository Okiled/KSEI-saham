import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
};

export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      className={`page-shell ${className}`.trim()}
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="page-shell-inner">{children}</div>
    </motion.main>
  );
}

export function EditorialFooter() {
  return (
    <footer className="page-footer">
      <p className="page-footer-copy">Data: KSEI + Yahoo Finance. Update harian. Bukan rekomendasi investasi.</p>
      <a
        href="https://x.com/Conaax"
        target="_blank"
        rel="noopener noreferrer"
        className="page-footer-link"
      >
        Made by CONA
      </a>
    </footer>
  );
}

export function SectionIntro({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-4 w-0.5 bg-[#996737]" />
        <span className="text-xs uppercase tracking-[0.22em] text-[#7A6E63]">{label}</span>
      </div>
      {description ? <p className="pl-[15px] text-sm leading-7 text-[#665A4F]">{description}</p> : null}
    </div>
  );
}
