import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-semibold">There's nothing here.</p>
      <Link to="/" className="mt-2 inline-block text-sm underline">
        See the six ways to get paid
      </Link>
    </div>
  );
}
