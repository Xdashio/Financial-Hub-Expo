/**
 * Enhanced error message utilities with actionable next steps
 * Provides user-friendly error messages with specific guidance
 */

export interface ErrorContext {
  action?: string;
  fallbackRoute?: string;
  details?: string;
}

export function getEnhancedErrorMessage(
  error: string | Error | unknown,
  context?: ErrorContext
): { title: string; message: string; action?: string; route?: string } {
  const errorStr = error instanceof Error ? error.message : String(error);
  
  // Network errors
  if (errorStr.toLowerCase().includes('network') || errorStr.toLowerCase().includes('connection')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      action: 'Retry',
    };
  }
  
  // Authentication errors
  if (errorStr.toLowerCase().includes('unauthorized') || errorStr.toLowerCase().includes('auth')) {
    return {
      title: 'Authentication Required',
      message: 'Your session has expired. Please sign in again to continue.',
      action: 'Sign In',
      route: '/(auth)/signin',
    };
  }
  
  // Insufficient funds errors
  if (errorStr.toLowerCase().includes('insufficient') || errorStr.toLowerCase().includes('balance')) {
    return {
      title: 'Insufficient Funds',
      message: 'This pocket doesn\'t have enough balance for this transaction. Consider reallocating money from another pocket.',
      action: 'Reallocate',
      route: '/(modals)/realloc-pick',
    };
  }
  
  // Validation errors
  if (errorStr.toLowerCase().includes('invalid') || errorStr.toLowerCase().includes('validation')) {
    return {
      title: 'Invalid Input',
      message: 'Please check your input and try again. Make sure all required fields are filled correctly.',
      action: 'Review Input',
    };
  }
  
  // Pocket not found
  if (errorStr.toLowerCase().includes('not found') || errorStr.toLowerCase().includes('pocket')) {
    return {
      title: 'Pocket Not Found',
      message: 'The requested pocket could not be found. It may have been deleted or you don\'t have access to it.',
      action: 'Go Back',
      route: context?.fallbackRoute || '/(tabs)',
    };
  }
  
  // Generic error with context
  return {
    title: 'Something went wrong',
    message: errorStr || 'An unexpected error occurred. Please try again.',
    action: context?.action || 'Retry',
    route: context?.fallbackRoute,
  };
}

export function getActionableNextStep(error: string | Error | unknown): string {
  const errorStr = error instanceof Error ? error.message : String(error);
  
  if (errorStr.toLowerCase().includes('network')) {
    return 'Check your internet connection';
  }
  if (errorStr.toLowerCase().includes('unauthorized')) {
    return 'Sign in to your account';
  }
  if (errorStr.toLowerCase().includes('insufficient')) {
    return 'Reallocate money from another pocket';
  }
  if (errorStr.toLowerCase().includes('invalid')) {
    return 'Review and correct your input';
  }
  
  return 'Try again or contact support if the problem persists';
}
