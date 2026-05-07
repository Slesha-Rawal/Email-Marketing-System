import React from "react";
import { cn } from "../../lib/utils.js";

const Button = React.forwardRef(
  ({ className, type = "button", variant = "default", ...props }, ref) => {
    const variants = {
      default:
        "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500",
      outline:
        "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-indigo-500",
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant] || variants.default,
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };
