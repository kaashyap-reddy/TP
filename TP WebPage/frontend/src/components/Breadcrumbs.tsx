interface BreadcrumbsProps {
  trail: string[];
}

export default function Breadcrumbs({ trail }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-4">
      {trail.map((item, i) => (
        <span key={item} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-300">/</span>}
          <span className={i === trail.length - 1 ? 'text-gray-600 font-bold' : ''}>{item}</span>
        </span>
      ))}
    </nav>
  );
}
