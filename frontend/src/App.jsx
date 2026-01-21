import { Dashboard } from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <div className="flex-1">
          <Dashboard />
        </div>
        <footer className="py-4 text-center text-sm text-gray-500">
          <p>
            © 2026 IP Quality Detection System |{' '}
            <a
              href="https://github.com/ssfun/ip-check"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              @sfun
            </a>
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
