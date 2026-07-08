import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold font-display uppercase leading-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground',
        accent: 'bg-accent text-accent-foreground border-2 border-forest',
        sky: 'bg-secondary text-secondary-foreground border-2 border-forest',
        success: 'bg-success text-success-foreground',
        muted: 'bg-muted text-muted-foreground',
        outline: 'border-2 border-border text-text',
      },
    },
    defaultVariants: { variant: 'primary' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { badgeVariants };
