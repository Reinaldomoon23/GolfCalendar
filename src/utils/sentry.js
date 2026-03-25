import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking
 * Only enabled in production environment
 */
export function initSentry() {
    // Only initialize in production
    if (import.meta.env.MODE !== 'production') {
        console.log('Sentry: Disabled in development');
        return;
    }

    // Check if DSN is configured
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
        console.warn('Sentry: DSN not configured. Error tracking disabled.');
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,

        // Set sample rate (1.0 = 100% of errors)
        tracesSampleRate: 1.0,

        // Capture unhandled promise rejections
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
        ],

        // Performance Monitoring
        tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

        // Session Replay (optional, captures user sessions with errors)
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

        // Ignore common errors that are not actionable
        ignoreErrors: [
            // Browser extensions
            'top.GLOBALS',
            'chrome-extension://',
            'moz-extension://',
            // Network errors
            'NetworkError',
            'Failed to fetch',
            // Cancel errors (user intentional)
            'AbortError',
        ],

        // Filter out PII (Personally Identifiable Information)
        beforeSend(event, hint) {
            // Remove email addresses from error messages
            if (event.message) {
                event.message = event.message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
            }

            // Remove potential UIDs from breadcrumbs
            if (event.breadcrumbs) {
                event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
                    if (breadcrumb.message) {
                        breadcrumb.message = breadcrumb.message.replace(/uid:\s*[a-zA-Z0-9]{20,}/g, 'uid: [REDACTED]');
                    }
                    return breadcrumb;
                });
            }

            return event;
        },
    });

    console.log('Sentry: Initialized successfully');
}

/**
 * Manually capture an exception
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
    if (import.meta.env.MODE !== 'production') {
        console.error('Sentry (dev):', error, context);
        return;
    }

    Sentry.captureException(error, {
        extra: context,
    });
}

/**
 * Capture a custom message
 * @param {string} message - The message to capture
 * @param {string} level - Severity level: 'fatal', 'error', 'warning', 'info', 'debug'
 */
export function captureMessage(message, level = 'info') {
    if (import.meta.env.MODE !== 'production') {
        console.log(`Sentry (dev) [${level}]:`, message);
        return;
    }

    Sentry.captureMessage(message, level);
}

/**
 * Set user context for better error tracking
 * @param {Object} user - User information
 */
export function setUser(user) {
    if (!user) {
        Sentry.setUser(null);
        return;
    }

    Sentry.setUser({
        id: user.uid,
        username: user.username || user.displayName,
        // Don't include email for privacy
    });
}

/**
 * Add breadcrumb (navigation trail)
 * @param {string} message - Breadcrumb message
 * @param {string} category - Category (e.g., 'navigation', 'api', 'user-action')
 * @param {Object} data - Additional data
 */
export function addBreadcrumb(message, category = 'info', data = {}) {
    if (import.meta.env.MODE !== 'production') {
        console.log(`Breadcrumb [${category}]:`, message, data);
        return;
    }

    Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
    });
}

/**
 * Track performance of async operations
 * @param {string} name - Operation name
 * @param {Function} fn - Async function to execute
 * @returns {Promise} Result of the function
 */
export async function trackPerformance(name, fn) {
    if (import.meta.env.MODE !== 'production') {
        console.log(`Performance tracking (dev): ${name}`);
        return await fn();
    }

    // Simple performance tracking without transactions
    const startTime = performance.now();

    try {
        const result = await fn();
        const duration = performance.now() - startTime;

        // Log as breadcrumb
        addBreadcrumb(`Performance: ${name} took ${duration.toFixed(2)}ms`, 'performance');

        return result;
    } catch (error) {
        captureException(error, { operation: name });
        throw error;
    }
}
