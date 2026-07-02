import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

class QuickErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught by QuickErrorBoundary:", error, errorInfo);
  }

  handleBack = () => {
    this.setState({ hasError: false });
    window.history.back();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            
            <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Something went wrong</h1>
            <h2 className="text-xl font-bold text-gray-800 mb-3">We hit a snag loading this page</h2>
            <p className="text-gray-500 mb-8 text-[15px] leading-relaxed">
              The page could not be loaded right now. Please go back and try again.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={this.handleBack}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <Link 
                to="/quick"
                onClick={() => this.setState({ hasError: false })}
                className="flex items-center justify-center px-6 py-3.5 bg-[#FF0000] hover:bg-[#E54D02] text-white rounded-xl font-bold transition-colors shadow-lg shadow-[#FF0000]/20"
              >
                Back to Home
              </Link>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default QuickErrorBoundary;
