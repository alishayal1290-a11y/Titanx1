
import React from 'react';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({ children, className, variant = 'primary', ...props }) => {
  const baseClasses = "px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2";
  
  const variantClasses = {
    primary: 'bg-amber-500 text-slate-900 hover:bg-amber-600 focus:ring-amber-400',
    secondary: 'bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};