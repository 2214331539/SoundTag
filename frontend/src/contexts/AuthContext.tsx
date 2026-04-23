import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";

import {
  clearSession,
  getMe,
  hydrateSession,
  passwordLogin as passwordLoginApi,
  persistSession,
  requestCode as requestCodeApi,
  verifyCode as verifyCodeApi,
} from "../services/api";
import { AuthPurpose, AuthUser, RequestCodeResponse } from "../types";


type AuthContextValue = {
  user: AuthUser | null;
  is_loading: boolean;
  requestCode: (phone: string, purpose: AuthPurpose) => Promise<RequestCodeResponse>;
  verifyCode: (
    phone: string,
    code: string,
    purpose: AuthPurpose,
    display_name?: string,
    password?: string,
  ) => Promise<void>;
  passwordLogin: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};


const AuthContext = createContext<AuthContextValue | undefined>(undefined);


export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [is_loading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const session = await hydrateSession();
      if (mounted && session.user) {
        setUser(session.user);
      }

      if (session.token) {
        try {
          const me = await getMe();
          if (mounted) {
            setUser(me);
          }
          await persistSession(session.token, me);
        } catch {
          await clearSession();
          if (mounted) {
            setUser(null);
          }
        }
      }

      if (mounted) {
        setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function requestCode(phone: string, purpose: AuthPurpose) {
    return requestCodeApi(phone, purpose);
  }

  async function verifyCode(
    phone: string,
    code: string,
    purpose: AuthPurpose,
    display_name?: string,
    password?: string,
  ) {
    const response = await verifyCodeApi(phone, code, purpose, display_name, password);
    await persistSession(response.access_token, response.user);
    setUser(response.user);
  }

  async function passwordLogin(phone: string, password: string) {
    const response = await passwordLoginApi(phone, password);
    await persistSession(response.access_token, response.user);
    setUser(response.user);
  }

  async function logout() {
    await clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        is_loading,
        requestCode,
        verifyCode,
        passwordLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
