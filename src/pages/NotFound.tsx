import { LinkButton } from '../components/ui';

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <div className="font-display text-7xl font-bold text-accent">404</div>
      <p className="mt-2 text-muted">That page is off the ice.</p>
      <LinkButton to="/" className="mt-6">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
