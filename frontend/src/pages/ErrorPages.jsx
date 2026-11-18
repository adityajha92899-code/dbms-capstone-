import { useNavigate } from 'react-router-dom';
import { FileQuestion, ShieldAlert, ServerCrash } from 'lucide-react';
import { Button } from '../components/ui/button';

function ErrorLayout({ icon: Icon, code, title, message }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-obsidian-100 text-obsidian-700">
        <Icon className="h-8 w-8" />
      </div>
      <p className="mt-4 font-mono text-sm font-semibold text-accent">{code}</p>
      <h1 className="mt-1 text-2xl font-bold text-obsidian-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-obsidian-500">{message}</p>
      <Button className="mt-6" onClick={() => navigate('/')}>
        Go home
      </Button>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorLayout
      icon={FileQuestion}
      code="404"
      title="Page not found"
      message="The page you are looking for does not exist or has been moved."
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorLayout
      icon={ShieldAlert}
      code="403"
      title="Access denied"
      message="You do not have permission to view this resource."
    />
  );
}

export function ServerErrorPage() {
  return (
    <ErrorLayout
      icon={ServerCrash}
      code="500"
      title="Something went wrong"
      message="An unexpected server error occurred. Please try again shortly."
    />
  );
}
