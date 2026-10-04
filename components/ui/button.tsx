import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-zinc-900 text-zinc-50 hover:bg-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] border border-zinc-900',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 shadow-xs border border-red-700/60',
        outline:
          'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
        secondary:
          'bg-zinc-100 text-zinc-900 hover:bg-zinc-200/80 border border-zinc-200/60',
        ghost: 'hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900',
        link: 'text-zinc-900 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9.5 px-4 py-2 text-sm',
        sm: 'h-8.5 rounded-lg px-3.5 py-1.5 text-xs font-medium',
        lg: 'h-11 rounded-lg px-6 py-2.5 text-sm font-medium',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        suppressHydrationWarning
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
