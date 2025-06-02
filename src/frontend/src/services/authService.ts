import { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';
import { User } from '../types/user';
import { API_BASE_URL } from '../config/apiConfig';

export class AuthService {
    private msalInstance: IPublicClientApplication;

    constructor(msalInstance: IPublicClientApplication) {
        this.msalInstance = msalInstance;
    }

    async login(): Promise<AccountInfo> {
        try {
            const loginResponse = await this.msalInstance.loginPopup({
                scopes: ['User.Read', 'openid', 'profile'],
            });
            await this.handleUserRegistration(loginResponse.account);
            return loginResponse.account;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    private async handleUserRegistration(account: AccountInfo): Promise<void> {
        try {
            const userData: User = {
                id: account.homeAccountId,
                username: account.name || account.username,
                email: account.username,
                powerpoints: [],
                videos: []
            };
            const response = await fetch(`${API_BASE_URL}/api/user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                // If it's a 409 (Conflict), user already exists - that's fine
                if (response.status === 409) {
                    console.log('User already exists in database');
                    return;
                }
                throw new Error(`Failed to create user: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('User registration result:', result);
        } catch (error) {
            console.error('User registration failed:', error);
            // Don't throw here - we don't want to break login if user creation fails
        }
    }

    async logout(): Promise<void> {
        try {
            await this.msalInstance.logoutPopup({
                postLogoutRedirectUri: 'http://localhost:5173',
            });
        } catch (error) {
            console.error('Logout failed:', error);
            throw error;
        }
    }

    getCurrentAccount(): AccountInfo | null {
        const accounts = this.msalInstance.getAllAccounts();
        return accounts.length > 0 ? accounts[0] : null;
    }

    async getAccessToken(): Promise<string | null> {
        const account = this.getCurrentAccount();
        if (!account) return null;

        try {
            const response = await this.msalInstance.acquireTokenSilent({
                scopes: ['User.Read'],
                account: account,
            });
            return response.accessToken;
        } catch (error) {
            console.error('Token acquisition failed:', error);
            // Try to acquire token with popup
            try {
                const response = await this.msalInstance.acquireTokenPopup({
                    scopes: ['User.Read'],
                    account: account,
                });
                return response.accessToken;
            } catch (popupError) {
                console.error('Popup token acquisition failed:', popupError);
                return null;
            }
        }
    }
}