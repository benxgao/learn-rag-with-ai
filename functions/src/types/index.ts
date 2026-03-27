import { Request } from 'express';

export type FirebaseJwtToken = {
  iss: string; // 'https://securetoken.google.com/fire-base-project-id-01';
  aud: string; // 'rpoejct_id';
  auth_time: number;
  user_id?: string; // 'uid';
  sub: string; // 'uid';
  iat: number;
  exp: number;
  email?: string; // '@gmail.com';
  email_verified?: boolean;
  firebase: {
    identities: { [key: string]: any }; // { email: string[] };
    sign_in_provider: string; // 'password';
  };
  uid: string; // 'uid';
};

export type CustomRequest = Request & {
  firebase_jwt_token: FirebaseJwtToken;
};
