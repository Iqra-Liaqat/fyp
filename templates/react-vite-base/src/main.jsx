import React from 'react';
import { createRoot } from 'react-dom/client';
import './base.css';
import App from './App.jsx';

// Shows runtime errors on screen instead of a blank page.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <pre className="fatal-error">The generated app crashed: {String(this.state.error)}</pre>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
