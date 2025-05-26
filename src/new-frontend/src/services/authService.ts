import { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';

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
            return loginResponse.account;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
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