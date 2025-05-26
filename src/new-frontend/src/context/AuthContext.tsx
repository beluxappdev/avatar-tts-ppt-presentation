import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from '../config/authConfig';
import { AuthService } from '../services/authService';

interface User {
    id: string;
    name: string;
    email: string;
    account: AccountInfo;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: () => Promise<void>;
    logout: () => void;
    getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL
msalInstance.initialize().then(() => {
    // Check if there are already accounts in the browser session
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
    }
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authService] = useState(() => new AuthService(msalInstance));

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const account = authService.getCurrentAccount();
            if (account) {
                const userData: User = {
                    id: account.homeAccountId,
                    name: account.name || account.username,
                    email: account.username,
                    account: account,
                };
                setUser(userData);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async () => {
        try {
            setLoading(true);
            const account = await authService.login();
            const userData: User = {
                id: account.homeAccountId,
                name: account.name || account.username,
                email: account.username,
                account: account,
            };
            setUser(userData);
        } catch (error) {
            console.error('Login failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await authService.logout();
            setUser(null);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const getAccessToken = async (): Promise<string | null> => {
        return await authService.getAccessToken();
    };

    return (
        <MsalProvider instance={msalInstance}>
            <AuthContext.Provider value={{
                user,
                isAuthenticated: !!user,
                loading,
                login,
                logout,
                getAccessToken
            }}>
                {children}
            </AuthContext.Provider>
        </MsalProvider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
