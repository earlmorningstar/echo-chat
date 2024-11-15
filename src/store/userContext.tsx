import {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
}

interface UserProviderProps {
  children: ReactNode;
}

export const UserContext = createContext<{
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
} | null>(null);

export const useUser = () => {
  return useContext(UserContext);
};

const getUserFromLocalStorage = () => {
  try {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Error parsing user data from localStorage:", error);
    return null;
  }
};

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(getUserFromLocalStorage);


  const fetchUser = async () => {
    const token = localStorage.getItem("token");
    if (token && !user) {
      try {
        const response = await fetch("/api/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          console.log("Fetched user data from API:", data);
          setUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        } else {
          console.error("Failed to fetch user data from API");
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    }
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (user) {
      console.log("Updating localStorage with user data:", user);
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      console.log("Clearing user data from localStorage");
      localStorage.removeItem("user");
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};


