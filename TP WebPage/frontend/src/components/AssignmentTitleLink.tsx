import { Link } from 'react-router-dom';

interface AssignmentTitleLinkProps {
  id: string;
  title: string;
}

/**
 * Assignment title cell for Admin/Facilitator assignment tables — a soft rounded rectangle
 * (not a pill), so a wrapped multi-line title keeps a stable card-like shape instead of
 * stretching into a tall oval and throwing off row height.
 */
export default function AssignmentTitleLink({ id, title }: AssignmentTitleLinkProps) {
  return (
    <Link
      to={`/assignments/${id}`}
      className="block w-full max-w-md text-left leading-snug break-words text-blue-600 font-medium px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors duration-150"
    >
      {title}
    </Link>
  );
}
