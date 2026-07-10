import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
  className?: string;
  wrap?: boolean;
}

export default function PageHeader({ title, children, className = 'mb-6', wrap = true }: PageHeaderProps) {
  return (
    <div className={`flex justify-between items-center ${wrap ? 'gap-4 flex-wrap ' : ''}${className}`}>
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </div>
  );
}
