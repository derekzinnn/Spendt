import { cn } from '@/lib/cn'

/** Sidebar / "Mais" link: steel wash + a 2px steel rule on the left when active. */
export const navLinkClass = (active: boolean) =>
  cn(
    'flex items-center gap-2.5 px-2.5 py-2 text-sm transition-colors duration-150 focus-visible:outline-offset-[-2px]',
    '[&_svg]:size-4.5 [&_svg]:shrink-0',
    active
      ? 'bg-steel-100 text-steel-800 shadow-[inset_2px_0_0_var(--steel)]'
      : 'text-foreground hover:bg-foreground/6',
  )
