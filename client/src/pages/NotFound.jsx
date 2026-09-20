import { Link } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-4 font-display text-display text-ivory">Out of bounds</h1>
        <p className="mx-auto mt-4 max-w-md text-ivory-faint">
          That page isn&apos;t on the card. Take a drop and play on from the homepage.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button to="/">Back to the homepage</Button>
          <Button to="/charities" variant="outline">
            Browse charities
          </Button>
        </div>
        <p className="mt-10 text-xs text-mist-500">
          If you followed a link from inside the app, <Link to="/dashboard" className="underline">your dashboard</Link> is still here.
        </p>
      </div>
    </div>
  );
}
