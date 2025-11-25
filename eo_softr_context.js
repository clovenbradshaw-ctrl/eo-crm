/**
 * EO Softr User Context Module
 *
 * Detects and tracks user context when EO Activibase is embedded in Softr pages.
 * Provides user identification, authentication state, and activity tracking.
 */

class SoftrContext {
    constructor(config = {}) {
        this.config = {
            enablePostMessage: config.enablePostMessage !== false,
            enableUrlParams: config.enableUrlParams !== false,
            enableLocalStorage: config.enableLocalStorage !== false,
            fallbackUser: config.fallbackUser || {
                id: 'anonymous',
                name: 'Anonymous User',
                email: null,
                role: 'viewer'
            }
        };

        this.currentUser = null;
        this.isEmbedded = false;
        this.parentOrigin = null;
        this.sessionId = this.generateSessionId();

        // User activity tracking
        this.activityLog = [];
        this.lastActivity = null;

        // Listeners
        this.userChangeListeners = [];
    }

    /**
     * Initialize Softr context detection
     */
    async initialize() {
        console.log('🔍 Detecting Softr context...');

        // Check if running in iframe (embedded in Softr)
        this.isEmbedded = window.self !== window.top;

        if (this.isEmbedded) {
            console.log('✓ Running in embedded mode (Softr iframe)');

            // Get parent origin
            this.parentOrigin = document.referrer ? new URL(document.referrer).origin : '*';

            // Set up PostMessage listener
            if (this.config.enablePostMessage) {
                this.setupPostMessageListener();
            }

            // Request user data from parent
            await this.requestUserData();
        } else {
            console.log('⚠ Running in standalone mode (not embedded)');
        }

        // Try to detect user from various sources
        await this.detectUser();

        // Set up activity tracking
        this.setupActivityTracking();

        return {
            isEmbedded: this.isEmbedded,
            user: this.currentUser,
            sessionId: this.sessionId
        };
    }

    /**
     * Set up PostMessage listener for Softr communication
     */
    setupPostMessageListener() {
        window.addEventListener('message', (event) => {
            // Security: verify origin if known
            if (this.parentOrigin !== '*' && event.origin !== this.parentOrigin) {
                console.warn('Ignoring message from unknown origin:', event.origin);
                return;
            }

            const { type, data } = event.data;

            switch (type) {
                case 'softr:user':
                    this.handleUserData(data);
                    break;

                case 'softr:auth':
                    this.handleAuthUpdate(data);
                    break;

                case 'softr:config':
                    this.handleConfigUpdate(data);
                    break;

                default:
                    // Ignore unknown message types
                    break;
            }
        });

        console.log('✓ PostMessage listener ready');
    }

    /**
     * Request user data from parent Softr page
     */
    async requestUserData() {
        if (!this.isEmbedded) return;

        // Send request to parent
        window.parent.postMessage({
            type: 'eo:request:user',
            sessionId: this.sessionId
        }, this.parentOrigin);

        console.log('📤 Requested user data from Softr parent');

        // Wait for response (with timeout)
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('Timeout waiting for Softr user data');
                resolve(null);
            }, 3000);

            const checkUser = setInterval(() => {
                if (this.currentUser) {
                    clearTimeout(timeout);
                    clearInterval(checkUser);
                    resolve(this.currentUser);
                }
            }, 100);
        });
    }

    /**
     * Detect user from various sources
     */
    async detectUser() {
        let user = null;

        // 1. Check URL parameters (e.g., ?user_id=123&user_email=user@example.com)
        if (this.config.enableUrlParams) {
            user = this.getUserFromUrl();
            if (user) {
                console.log('✓ User detected from URL parameters');
                this.setUser(user);
                return;
            }
        }

        // 2. Check localStorage (persisted from previous session)
        if (this.config.enableLocalStorage) {
            user = this.getUserFromLocalStorage();
            if (user) {
                console.log('✓ User restored from localStorage');
                this.setUser(user);
                return;
            }
        }

        // 3. Check Softr global object (if available)
        user = this.getUserFromSoftrGlobal();
        if (user) {
            console.log('✓ User detected from Softr global object');
            this.setUser(user);
            return;
        }

        // 4. Use fallback user
        console.log('⚠ Using fallback user (anonymous)');
        this.setUser(this.config.fallbackUser);
    }

    /**
     * Get user from URL parameters
     */
    getUserFromUrl() {
        const params = new URLSearchParams(window.location.search);

        const userId = params.get('user_id') || params.get('userId');
        const userEmail = params.get('user_email') || params.get('email');
        const userName = params.get('user_name') || params.get('name');
        const userRole = params.get('user_role') || params.get('role');

        if (userId || userEmail) {
            return {
                id: userId,
                email: userEmail,
                name: userName || userEmail?.split('@')[0] || 'User',
                role: userRole || 'user',
                source: 'url_params'
            };
        }

        return null;
    }

    /**
     * Get user from localStorage
     */
    getUserFromLocalStorage() {
        try {
            const stored = localStorage.getItem('eo_softr_user');
            if (stored) {
                const user = JSON.parse(stored);
                user.source = 'local_storage';
                return user;
            }
        } catch (error) {
            console.error('Error reading user from localStorage:', error);
        }

        return null;
    }

    /**
     * Get user from Softr global object (if available)
     */
    getUserFromSoftrGlobal() {
        // Check various Softr global patterns
        const softrUser = window.softr?.user || window.Softr?.user || window.currentUser;

        if (softrUser) {
            return {
                id: softrUser.id || softrUser.user_id,
                email: softrUser.email,
                name: softrUser.name || softrUser.full_name,
                role: softrUser.role,
                avatar: softrUser.avatar || softrUser.profile_image,
                metadata: softrUser.metadata || {},
                source: 'softr_global'
            };
        }

        return null;
    }

    /**
     * Handle user data from PostMessage
     */
    handleUserData(userData) {
        const user = {
            id: userData.id || userData.user_id,
            email: userData.email,
            name: userData.name || userData.full_name,
            role: userData.role,
            avatar: userData.avatar,
            metadata: userData.metadata || {},
            source: 'postmessage'
        };

        console.log('✓ Received user data from Softr:', user.email);
        this.setUser(user);
    }

    /**
     * Handle auth update from PostMessage
     */
    handleAuthUpdate(authData) {
        if (authData.authenticated === false) {
            console.log('⚠ User logged out');
            this.setUser(this.config.fallbackUser);
        } else if (authData.user) {
            this.handleUserData(authData.user);
        }
    }

    /**
     * Handle config update from PostMessage
     */
    handleConfigUpdate(configData) {
        console.log('✓ Received config update from Softr');
        Object.assign(this.config, configData);
    }

    /**
     * Set current user and notify listeners
     */
    setUser(user) {
        const previousUser = this.currentUser;
        this.currentUser = user;

        // Persist to localStorage
        if (this.config.enableLocalStorage && user.id !== 'anonymous') {
            try {
                localStorage.setItem('eo_softr_user', JSON.stringify(user));
            } catch (error) {
                console.error('Error saving user to localStorage:', error);
            }
        }

        // Notify listeners
        this.userChangeListeners.forEach(listener => {
            try {
                listener(user, previousUser);
            } catch (error) {
                console.error('Error in user change listener:', error);
            }
        });

        // Send acknowledgment to parent
        if (this.isEmbedded) {
            window.parent.postMessage({
                type: 'eo:user:updated',
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                },
                sessionId: this.sessionId
            }, this.parentOrigin);
        }
    }

    /**
     * Get current user
     */
    getUser() {
        return this.currentUser;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser && this.currentUser.id !== 'anonymous';
    }

    /**
     * Check if user has specific role
     */
    hasRole(role) {
        return this.currentUser?.role === role;
    }

    /**
     * Register user change listener
     */
    onUserChange(callback) {
        this.userChangeListeners.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this.userChangeListeners.indexOf(callback);
            if (index > -1) {
                this.userChangeListeners.splice(index, 1);
            }
        };
    }

    /**
     * Set up activity tracking
     */
    setupActivityTracking() {
        // Track mouse activity
        document.addEventListener('click', (event) => {
            this.trackActivity('click', {
                target: event.target.tagName,
                x: event.clientX,
                y: event.clientY
            });
        });

        // Track keyboard activity
        document.addEventListener('keydown', (event) => {
            this.trackActivity('keydown', {
                key: event.key,
                ctrl: event.ctrlKey,
                shift: event.shiftKey
            });
        });

        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            this.trackActivity('visibility', {
                visible: !document.hidden
            });
        });

        // Track focus/blur
        window.addEventListener('focus', () => {
            this.trackActivity('focus', { focused: true });
        });

        window.addEventListener('blur', () => {
            this.trackActivity('focus', { focused: false });
        });

        console.log('✓ Activity tracking enabled');
    }

    /**
     * Track user activity
     */
    trackActivity(type, data = {}) {
        const activity = {
            type,
            timestamp: new Date().toISOString(),
            user: this.currentUser,
            sessionId: this.sessionId,
            data
        };

        this.activityLog.push(activity);
        this.lastActivity = activity;

        // Keep only last 100 activities
        if (this.activityLog.length > 100) {
            this.activityLog.shift();
        }

        // Send to parent if embedded
        if (this.isEmbedded && type !== 'visibility' && type !== 'focus') {
            window.parent.postMessage({
                type: 'eo:activity',
                activity: {
                    type,
                    timestamp: activity.timestamp,
                    userId: this.currentUser?.id
                },
                sessionId: this.sessionId
            }, this.parentOrigin);
        }
    }

    /**
     * Get activity log
     */
    getActivityLog(limit = 10) {
        return this.activityLog.slice(-limit);
    }

    /**
     * Get session info
     */
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            isEmbedded: this.isEmbedded,
            parentOrigin: this.parentOrigin,
            user: this.currentUser,
            lastActivity: this.lastActivity,
            activityCount: this.activityLog.length
        };
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Send message to parent Softr page
     */
    sendToParent(type, data) {
        if (!this.isEmbedded) {
            console.warn('Cannot send to parent: not embedded');
            return;
        }

        window.parent.postMessage({
            type: `eo:${type}`,
            data,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
        }, this.parentOrigin);
    }

    /**
     * Clear user session
     */
    clearSession() {
        this.currentUser = this.config.fallbackUser;

        if (this.config.enableLocalStorage) {
            localStorage.removeItem('eo_softr_user');
        }

        console.log('✓ User session cleared');
    }

    /**
     * Get user context for activity logging
     */
    getUserContext() {
        return {
            user_id: this.currentUser?.id,
            user_email: this.currentUser?.email,
            user_name: this.currentUser?.name,
            user_role: this.currentUser?.role,
            session_id: this.sessionId,
            is_embedded: this.isEmbedded,
            parent_origin: this.parentOrigin
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoftrContext;
}
