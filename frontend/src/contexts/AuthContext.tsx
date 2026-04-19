import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";

import {
  clearSession,
  getMe,
  hydrateSession,
  persistSession,
  requestCode as requestCodeApi,
  verifyCode as verifyCodeApi,
} from "../services/api";
import { AuthUser, RequestCodeResponse } from "../types";


type AuthContextValue = {
  user: AuthUser | null;
  is_loading: boolean;
  requestCode: (phone: string) => Promise<RequestCodeResponse>;
  verifyCode: (phone: string, code: string, display_name?: string) => Promise<void>;
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

  async function requestCode(phone: string) {
    return requestCodeApi(phone);
  }

  async function verifyCode(phone: string, code: string, display_name?: string) {
    const response = await verifyCodeApi(phone, code, display_name);
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
