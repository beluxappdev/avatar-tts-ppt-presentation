import { Configuration, PopupRequest } from '@azure/msal-browser';
console.log('window.location.origin:', window.location.origin);
console.log('window.location.href:', window.location.href);

// MSAL configuration
export const msalConfig: Configuration = {
    auth: {
        clientId: 'fca495de-e9eb-4bb4-82f6-dbcaf9a9771e',
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: "http://localhost:5173", // This is the URL where MSAL will redirect after login
        postLogoutRedirectUri: "http://localhost:5173",
    },
    cache: {
        cacheLocation: 'sessionStorage', // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest: PopupRequest = {
    scopes: ['User.Read', 'openid', 'profile'],
};

// Add the endpoints here for Microsoft Graph API services you'd like to use.
export const graphConfig = {
    graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
};