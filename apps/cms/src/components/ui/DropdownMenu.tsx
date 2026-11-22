import * as React from 'react';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { optionClassName, popupClassName, popupLabelClassName } from './popupStyles';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 6, collisionPadding = 12, align = 'end', ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      align={align}
      className={cn(popupClassName, 'min-w-48 max-w-[calc(100vw-1.5rem)] p-1', className)}
      {...props}
    />
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

interface ItemProps extends React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> {
  /** Acción destructiva: texto en rojo de marca. */
  destructive?: boolean;
}

export const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof MenuPrimitive.Item>, ItemProps>(
  ({ className, destructive, ...props }, ref) => (
    <MenuPrimitive.Item
      ref={ref}
      className={cn(
        optionClassName,
        '[&_svg]:size-4 [&_svg]:shrink-0',
        destructive && 'text-destructive data-[highlighted]:bg-sky-soft data-[highlighted]:text-sky-strong',
        className
      )}
      {...props}
    />
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.CheckboxItem ref={ref} className={cn(optionClassName, 'pl-9', className)} {...props}>
    <span className="absolute left-3 flex size-4 items-center justify-center">
      <MenuPrimitive.ItemIndicator>
        <Check className="size-4" aria-hidden="true" />
      </MenuPrimitive.ItemIndicator>
    </span>
    {children}
  </MenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.RadioItem ref={ref} className={cn(optionClassName, 'pl-9', className)} {...props}>
    <span className="absolute left-3 flex size-4 items-center justify-center">
      <MenuPrimitive.ItemIndicator>
        <Circle className="size-2 fill-current" aria-hidden="true" />
      </MenuPrimitive.ItemIndicator>
    </span>
    {children}
  </MenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn(popupLabelClassName, className)} {...props} />;
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-0.5 bg-border', className)} {...props} />;
}
