interface HighlightMatchProps {
  text: string;
  query: string;
}

export default function HighlightMatch({ text, query }: HighlightMatchProps) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 text-inherit rounded-sm px-0.5">{match}</mark>
      {after}
    </>
  );
}
